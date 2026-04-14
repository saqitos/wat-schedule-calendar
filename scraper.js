const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

function getStartTime(n) {
    const times = ["08:00", "09:50", "11:40", "13:30", "16:00", "17:50", "19:40"];
    return times[n - 1];
}

function getEndTime(n) {
    const times = ["09:35", "11:25", "13:15", "15:05", "17:35", "19:25", "21:15"];
    return times[n - 1];
}

async function scrape() {
    console.log("Fetching schedule...");
    const url = 'https://planzajec.wcy.wat.edu.pl/pl/rozklad?grupa_id=WCY25KX1S4';
    
    // Pass standard browser headers to avoid Imperva firewall blocks
    const { data } = await axios.get(url, {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7'
        }
    });
    
    const $ = cheerio.load(data);
    const lessons = $('.lesson');
    
    console.log(`Found ${lessons.length} lessons on the page.`);
    
    if (lessons.length === 0) {
        // If the firewall blocked us, the title will usually say "Incapsula" or "Just a moment"
        console.log("Page title:", $('title').text());
        throw new Error("No lessons found! The university firewall (Imperva) likely blocked the GitHub Actions IP.");
    }

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//WAT Schedule//EN
CALSCALE:GREGORIAN
X-WR-TIMEZONE:Europe/Warsaw
BEGIN:VTIMEZONE
TZID:Europe/Warsaw
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE\n`;

    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lessons.each((i, el) => {
        const dateStr = $(el).find('.date').text().trim();
        const blockIdStr = $(el).find('.block_id').text().trim();
        
        let textParts = [];
        $(el).find('.name').contents().each((_, child) => {
            if (child.type === 'text') {
                const txt = $(child).text().trim();
                if (txt) textParts.push(txt);
            }
        });

        if (textParts.length > 0 && textParts[0] !== 'JoM') {
            const n = parseInt(blockIdStr.replace('block', ''));
            const text = textParts.join(' ');
            
            const [yyyy, mm, dd] = dateStr.split('_');
            const startStr = `${yyyy}${mm}${dd}T${getStartTime(n).replace(':', '')}00`;
            const endStr = `${yyyy}${mm}${dd}T${getEndTime(n).replace(':', '')}00`;
            const uid = `${dateStr}-${n}-WCY25KX1S4@wat.edu.pl`;
            const description = $(el).find('.info').text().trim();

            icsContent += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART;TZID=Europe/Warsaw:${startStr}
DTEND;TZID=Europe/Warsaw:${endStr}
SUMMARY:${text}
DESCRIPTION:${description}
END:VEVENT\n`;
        }
    });

    icsContent += `END:VCALENDAR\n`;

    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)){
        fs.mkdirSync(publicDir);
    }
    fs.writeFileSync(path.join(publicDir, 'schedule.ics'), icsContent);
    console.log("Successfully generated public/schedule.ics!");
}

scrape().catch(err => {
    console.error(err.message);
    process.exit(1); // Fails the GitHub Action so it doesn't upload a blank calendar
});
