const fs = require('fs');

const analyzeEngineers = () => {
    const data = JSON.parse(fs.readFileSync('engineers.json', 'utf8'));
    
    // Create grouping ranges
    const groups = {
        '20000-49999': [],
        '50000-99999': [],
        '100000-149999': [],
        '150000-4999999': [],
        '5000000-5099999': [],
        '6000000-6099999': [],
        'other': []
    };

    // Process each engineer
    data.forEach(engineer => {
        const id = parseInt(engineer.id);
        
        // More detailed grouping logic
        if (id < 20000) {
            groups['other'].push(engineer);
        } else if (id < 50000) {
            groups['20000-49999'].push(engineer);
        } else if (id < 100000) {
            groups['50000-99999'].push(engineer);
        } else if (id < 150000) {
            groups['100000-149999'].push(engineer);
        } else if (id < 5000000) {
            groups['150000-4999999'].push(engineer);
        } else if (id < 5100000) {
            groups['5000000-5099999'].push(engineer);
        } else if (id < 6100000) {
            groups['6000000-6099999'].push(engineer);
        } else {
            groups['other'].push(engineer);
        }
    });

    // Output results
    console.log('\nEngineers Analysis:');
    console.log(`Total Engineers: ${data.length}`);
    
    for (const [range, members] of Object.entries(groups)) {
        if (members.length > 0) {
            console.log(`\n${range}:`);
            console.log(`  Count: ${members.length}`);
            console.log(`  Percentage: ${((members.length / data.length) * 100).toFixed(1)}%`);
            if (members.length > 0) {
                const ids = members.map(m => parseInt(m.id));
                console.log(`  Range: ${Math.min(...ids)} to ${Math.max(...ids)}`);
                // Show a few examples if there are any unexpected groupings
                if (range === 'other' || range === '50000-99999' || range === '150000-4999999') {
                    console.log('  Examples:');
                    members.slice(0, 3).forEach(m => {
                        console.log(`    - ${m.id}: ${m.firstName} ${m.lastName}`);
                    });
                }
            }
        }
    }

    // Additional verification
    const allIds = data.map(e => parseInt(e.id));
    console.log('\nOverall Range:');
    console.log(`Lowest ID: ${Math.min(...allIds)}`);
    console.log(`Highest ID: ${Math.max(...allIds)}`);
}

try {
    analyzeEngineers();
} catch (error) {
    console.error('Error processing engineers:', error.message);
} 