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

// Converts DD_MM_YYYY and HH:mm into ICS timestamp format (YYYYMMDDTHHmm00)
function formatICSDate(dateClass, timeStr) {
    const [dd, mm, yyyy] = dateClass.split('_');
    const [hh, min] = timeStr.split(':');
    return `${yyyy}${mm}${dd}T${hh}${min}00`;
}

async function scrape() {
    console.log("Fetching schedule...");
    const url = 'https://planzajec.wcy.wat.edu.pl/pl/rozklad?grupa_id=WCY25KX1S4';
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Initialize the iCalendar file string with the Warsaw Timezone
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

    $('.day').each((i, dayEl) => {
        // Find the class like "14_04_2026"
        const classes = $(dayEl).attr('class').split(' ');
        const dateClass = classes.find(c => c.match(/\d{2}_\d{2}_\d{4}/));
        if (!dateClass) return;

        let n = 1;
        $(dayEl).find('.block').each((j, blokEl) => {
            const htmlContent = $(blokEl).html();
            
            if (htmlContent && htmlContent.trim() !== '') {
                // Emulate your childNodes text extraction logic by grouping valid text nodes
                let textParts = [];
                $(blokEl).contents().each((_, el) => {
                    if (el.type === 'text') {
                        const txt = $(el).text().trim();
                        if (txt) textParts.push(txt);
                    }
                });

                const text = textParts.join(' ');

                // Ignore JoM (Język obcy) per your original script
                if (textParts.length > 0 && textParts[0] !== 'JoM') {
                    const start = formatICSDate(dateClass, getStartTime(n));
                    const end = formatICSDate(dateClass, getEndTime(n));
                    const uid = `${dateClass}-${n}-WCY25KX1S4@wat.edu.pl`;

                    icsContent += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART;TZID=Europe/Warsaw:${start}
DTEND;TZID=Europe/Warsaw:${end}
SUMMARY:${text}
END:VEVENT\n`;
                }
            }
            n++;
        });
    });

    icsContent += `END:VCALENDAR`;

    // Save to a public folder for GitHub Pages to host
    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)){
        fs.mkdirSync(publicDir);
    }
    fs.writeFileSync(path.join(publicDir, 'schedule.ics'), icsContent);
    console.log("Successfully generated public/schedule.ics!");
}

scrape().catch(console.error);
