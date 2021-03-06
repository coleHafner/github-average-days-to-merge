const rp = require('request-promise');
const chalk = require('chalk');

const user = process.argv[2];
const oAuthToken = process.argv[3];
const org = process.argv[4] || 'NordicPlayground';
const repo = process.argv[5] || 'nrfcloud-web-frontend';
const analyzeTotalPrs = process.argv[6] || 30;

const resultsPerPage = analyzeTotalPrs >= 100 ? 100 : analyzeTotalPrs;
const usageExample = 'Usage: node index.js <username> <oAuth token> <org> <repo> <total prs>';

if (['help', '--help'].includes(user)) {
    help(`

${usageExample}

`);
    return;
}

if (!oAuthToken || !user) {
    error(`
    
Error: User and oAuth token required.

${usageExample}

`);
    process.exit();
}

(async () => {
    const uri = `https://api.github.com/repos/${org}/${repo}/pulls?state=closed&per_page=${resultsPerPage}`;

    const opts = {
        uri,
        method: 'GET',
        resolveWithFullResponse: true,
        headers: {
            authorization: `token ${oAuthToken}`, 
            'User-Agent': user
        },
    };

    const l = new Log();
    let nextLink = null;
    let allPulls = [];

    do {
        if (nextLink) {
            opts.uri = nextLink;
        }

        l.debug(`querying "${opts.uri}"`);
        const res = await rp(opts);
        const headers = res.headers;
        const pulls = JSON.parse(res.body);
        const linksArr = headers.link.split(',');

        allPulls.push(...pulls);

        nextLink = allPulls.length < analyzeTotalPrs
            ? getNextLink(linksArr)
            : null;

    } while(nextLink !== null);

    const secondsInDay = 60* 60 * 24;
    let totalMergedPrs = 0;
    let totalNotMerged = 0;
    let totalDiff = 0;

    l.header('all pulls', 'info');
    allPulls.forEach(pull => {
        if ((totalNotMerged + totalMergedPrs) > analyzeTotalPrs) {
            return;
        }

        if (!pull.created_at || !pull.merged_at) {
            totalNotMerged++;
            return;
        }

        const start = (new Date(pull.created_at)).getTime();
        const end = (new Date(pull.merged_at)).getTime();
        const diffInSeconds = (end - start)/1000;
        const diffInDaysNumber = diffInSeconds/secondsInDay;
        const diffInDays = `${diffInDaysNumber.toFixed(2)} days`;
        
        totalDiff += diffInDaysNumber;
        totalMergedPrs++;

        l.info(`${totalMergedPrs}. ${pull.created_at} => ${pull.merged_at} => ${diffInDays} => "${pull.title}"`);
    });

    const avgTimeToMerge = (totalDiff/totalMergedPrs).toFixed(2);
    l.header('totals', 'summary');

    l.summary(`
Total prs: ${totalMergedPrs + totalNotMerged}
Total merged: ${totalMergedPrs}
Avg time-to-merge: ${avgTimeToMerge} days

    `);
})()

function Log() {
    const out = (msg, color) => console.log(chalk[color](msg));
    this.info = msg => out(msg, 'gray');
    this.error =  msg => out(msg, 'red');
    this.help =  msg => out(msg, 'cyan');
    this.debug =  msg => out(msg, 'yellow');
    this.summary =  msg => out(msg, 'green');
    this.header = (msg, func) => this[func || 'info'](`
*************************************
${msg.toUpperCase()}
*************************************`);
}


function getNextLink(linksArr) {
    let nextLink = null;
    
    for (let i = 0, len = linksArr.length; i < len; ++i) {
        const curLink = linksArr[i].split('; ');
        const link = curLink[0] || null;
        const linkType = curLink[1].split('=')[1]|| null;

        if (linkType.replace(/"/g, '') === 'next') {
            nextLink = link.replace(/[\s,>,<]/g, '');
            break;
        }
    }

    return nextLink;
}
