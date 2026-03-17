/* eslint-disable no-console */
const core = require('@actions/core');
const GhostAdminApi = require('@tryghost/admin-api');
const fs = require('fs');

const getValue = () => {
    let value = core.getInput('value');
    if (value === 'true') {
        value = true;
    } else if (value === 'false') {
        value = false;
    }
    return value;
};

const calculateDaysSince = (date) => {
    const now = new Date();
    const then = new Date(date);
    return Math.round((now - then) / (1000 * 60 * 60 * 24));
};

(async function main() {
    const updated = [];
    let skipped = 0;

    try {
        const api = new GhostAdminApi({
            url: core.getInput('api-url'),
            key: core.getInput('api-key'),
            version: 'canary'
        });

        const tag = core.getInput('tag');
        const field = core.getInput('field');
        const value = getValue();
        const days = parseInt(core.getInput('days'), 10);

        const allPosts = await api.posts.browse({filter: `tag:${tag}`, limit: 'all', include: 'tags'});
        const posts = allPosts.filter(post => post.status === 'published');

        console.log(`Found ${allPosts.length} total posts with tag, ${posts.length} are published.`);

        for (const post of posts) {
            const differenceInDays = calculateDaysSince(post.published_at);
            console.log(`Post "${post.title}" published ${differenceInDays} days ago`);

            if (differenceInDays > days) {
                post[field] = value;
                console.log(`UPDATING POST "${post.title}"`);
                await api.posts.edit(post);
                updated.push(post.title);
            } else {
                console.log(`Not updating post "${post.title}", ${days - differenceInDays + 1} days to go`);
                skipped++;
            }
        }

        const summary = [
            `## Run Summary`,
            `- **Posts checked:** ${posts.length}`,
            `- **Posts updated:** ${updated.length}`,
            `- **Posts skipped:** ${skipped}`,
            updated.length > 0 ? `\n### Updated posts\n${updated.map(t => `- ${t}`).join('\n')}` : ''
        ].join('\n');

        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
        console.log(`\nUpdated ${updated.length} post(s).`);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}());
