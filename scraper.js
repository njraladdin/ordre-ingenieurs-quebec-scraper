const puppeteer = require('puppeteer');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

async function monitorOIQ() {
    const userDataDir = path.join(os.tmpdir(), 'puppeteer-user-data');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        userDataDir: userDataDir,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list'
        ]
    });

    const page = await browser.newPage();

    // Enable request interception
    await page.setRequestInterception(true);

    // Monitor and filter network requests
    page.on('request', request => {
        const resourceType = request.resourceType();
        const url = request.url();

        // Block unnecessary resource types
        const blockedResources = [
            'image',
            'media',
            'font',
            'texttrack',
            'object',
            'beacon',
            'csp_report',
            'imageset',
        ];

        // Block social media and tracking domains
        const blockedDomains = [
            'google-analytics.com',
            'doubleclick.net',
            'facebook.com',
            'google.com/ads',
            'google.com/recaptcha',
            'googletagmanager.com',
            'hotjar.com',
            'analytics',
        ];

        // Check if the request should be blocked
        if (
            blockedResources.includes(resourceType) ||
            blockedDomains.some(domain => url.includes(domain))
        ) {
            request.abort();
            return;
        }

        // Log POST requests
        if (request.method() === 'POST') {
            console.log('POST Request URL:', request.url());
            console.log('------------------------');
        }

        // Allow the request to proceed
        request.continue();
    });

    try {
        // Set up performance optimizations
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        // Disable unnecessary features
        await page.setJavaScriptEnabled(true); // Keep JS enabled but you can disable if needed
        await page.setCacheEnabled(false);
        
        // Additional performance settings
        await page.setDefaultNavigationTimeout(60000);
        
        // Navigate to the website and wait for it to fully load
        await page.goto('https://membres.oiq.qc.ca/OIQ/Public/En/Directory/Search.aspx', {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Inject a custom button for scraping
        await page.evaluate(() => {
            const button = document.createElement('button');
            button.id = 'startScraping';
            button.innerHTML = 'Start Scraping';
            button.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 10000;
                padding: 10px 20px;
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            `;
            document.body.appendChild(button);
        });

        // Modify the logResults function to handle file operations
        await page.exposeFunction('logResults', async (newResults) => {
            const filePath = path.join(__dirname, 'engineers.json');
            let existingEngineers = [];
            let duplicates = 0;
            let added = 0;

            // Read existing file if it exists
            try {
                const fileContent = await fs.readFile(filePath, 'utf8');
                existingEngineers = JSON.parse(fileContent);
            } catch (error) {
                // File doesn't exist or is invalid, start with empty array
                existingEngineers = [];
            }

            // Check for duplicates and add new entries
            for (const engineer of newResults) {
                const isDuplicate = existingEngineers.some(
                    existing => existing.id === engineer.id
                );

                if (isDuplicate) {
                    duplicates++;
                } else {
                    existingEngineers.push(engineer);
                    added++;
                }
            }

            // Save the updated array back to file
            await fs.writeFile(
                filePath,
                JSON.stringify(existingEngineers, null, 2),
                'utf8'
            );

            console.log(`Scraping Results:`);
            console.log(`- Found ${newResults.length} engineers`);
            console.log(`- Added ${added} new engineers`);
            console.log(`- Found ${duplicates} duplicates (skipped)`);
            console.log(`- Total engineers in database: ${existingEngineers.length}`);
        });

        await page.evaluate(() => {
            document.getElementById('startScraping').addEventListener('click', () => {
                const rows = document.querySelectorAll('tr.rgRow, tr.rgAltRow');
                const results = Array.from(rows).map(row => {
                    const cells = row.querySelectorAll('td');
                    return {
                        lastName: cells[0]?.textContent?.trim() || '',
                        firstName: cells[1]?.textContent?.trim() || '',
                        title: cells[2]?.textContent?.trim() || '',
                        region: cells[3]?.textContent?.trim() || '',
                        id: cells[4]?.textContent?.trim() || ''
                    };
                });
                window.logResults(results);
            });
        });

        // Keep the browser open
        // await browser.close();
    } catch (error) {
        console.error('Error:', error);
        await browser.close();
    }
}

monitorOIQ(); 