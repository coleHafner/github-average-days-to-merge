const rp = require('request-promise');
const chalk = require('chalk');

const user = process.argv[2];
const oAuthToken = process.argv[3];

if (user === 'help') {
    console.log(chalk.cyan(`

Example: node index.js <gitHub username> <gitHub oAuth token>

`));
    return;
}

if (!oAuthToken || !user) {
    console.log(chalk.red(`
    
Error: User and oAuth token required.

`));
    process.exit();
}

const uri = 'https://api.github.com/repos/NordicPlayground/nrfcloud-web-frontend/pulls?state=closed&per_page=100';

const opts = {
    uri,
    method: 'GET',
    resolveWithFullResponse: true,
    headers: {
        authorization: `token ${oAuthToken}`, 
        'User-Agent': user
    },
};

(async () => {
    let nextLink = null;
    let allPulls = [];

    do {
        if (nextLink) {
            opts.uri = nextLink;
        }

        // console.log(`querying "${opts.uri}"`);
        const res = await rp(opts);
        const headers = res.headers;
        const pulls = JSON.parse(res.body);
        const linksArr = headers.link.split(',');
        nextLink = null;

        for (let i = 0, len = linksArr.length; i < len; ++i) {
            const link = linksArr[i].split('; ')[0] || null;
            const linkType = linksArr[i].split('; ')[1].split('=')[1] || null;
            if (linkType === '"next"') {
                nextLink = link.replace(/[\s,>,<]/g, '');
                break;
            }
        }

        allPulls.push(...pulls);
    } while(nextLink !== null);

    let totalMergedPrs = 0;
    let totalNotMerged = 0;
    let totalDiff = 0;

    allPulls.forEach(pull => {
        if (!pull.created_at || !pull.merged_at) {
            totalNotMerged++;
            return;
        }

        const start = (new Date(pull.created_at)).getTime();
        const end = (new Date(pull.merged_at)).getTime();
        const diffInSeconds = (end - start)/1000;

        const secondsInDay = 60* 60 * 24;
        const diffInDaysNumber = diffInSeconds/secondsInDay;
        const diffInDays = `${diffInDaysNumber.toFixed(2)} days`;
        
        totalDiff += diffInDaysNumber;
        totalMergedPrs++;
        console.log(chalk.gray(`${totalMergedPrs}. ${pull.created_at} => ${pull.merged_at} => ${diffInDays} => "${pull.title}"`));
    });

    const avgTimeToMerge = (totalDiff/totalMergedPrs).toFixed(2);

    console.log(chalk.green(`

total prs: ${totalMergedPrs + totalNotMerged}
total merged: ${totalMergedPrs}
avg wait time: ${avgTimeToMerge} days

    `));
})()
