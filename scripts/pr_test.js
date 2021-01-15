/*
 * related url:
 * https://github.com/actions/github-script
 * https://github.com/jitterbit/get-changed-files/blob/master/src/main.ts
 */

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const loadPluginName = function(filePath) {
    const j = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return j.name ? j.name : "";
}

const isPackageJson = function(filePath) {
    return "package.json" === path.basename(filePath);
}

const isPathMatchName = function(pluginPath, pluginName) {
    let shaa = pluginPath.substr(8, 2);
    shaa = shaa.concat(pluginPath.substr(11, 2));
    shaa = shaa.concat(pluginPath.substr(14, 2));
    let shab = crypto.createHash('sha512').update(pluginName.toLowerCase()).digest('hex');
    shab = shab.substr(0, 6);

    return shaa === shab;
}

const prTest = function(require, github, context, core) {
    let baseSHA = null;
    let headSHA = null;

    if (context.payload.pull_request) {
        baseSHA = context.payload.pull_request.base ? context.payload.pull_request.base.sha : ""
        headSHA = context.payload.pull_request.head ? context.payload.pull_request.head.sha : ""
    }

    if (!baseSHA || !headSHA) {
        core.setFailed(`The base and head commits are missing from the payload for this ${context.eventName} event.`)
    }

    // Use GitHub's compare two commits API.
    // https://developer.github.com/v3/repos/commits/#compare-two-commits
    const response = await client.repos.compareCommits({
        baseSHA,
        headSHA,
        owner: context.repo.owner,
        repo: context.repo.repo
    })

    // Ensure that the request was successful.
    if (response.status !== 200) {
        core.setFailed(
        `The GitHub API for comparing the base and head commits for this ${context.eventName} event returned ${response.status}, expected 200. ` +
            "Please submit an issue on this action's GitHub repo."
        )
    }

    // Ensure that the head commit is ahead of the base commit.
    if (response.data.status !== 'ahead') {
        core.setFailed(
        `The head commit for this ${context.eventName} event is not ahead of the base commit. ` +
            "Please submit an issue on this action's GitHub repo."
        )
    }

    for (const file of response.data.files) {
        core.info(`Changed file name: ${file.filename}`)
        if (isPackageJson(file.filename)) {
            const pluginName = loadPluginName(file.filename)
            if (!pluginName) {
                core.setFailed(`can't load plugin name from ${file.filename}`);
            }
            if (!isPathMatchName(file.filename, pluginName)) {
                core.setFailed(`Plugin path is not match plugin name ${file.filename} => ${pluginName}`);
            }
        }
    }
}

module.exports = ({github, context, core, io}) => {
    try {
        prTest(github, context, core);
    } catch (error) {
        core.setFailed(error.message);
    }
}
