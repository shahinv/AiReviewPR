"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const utils_1 = require("./utils");
const prompt_1 = require("./prompt");
const useChinese = (process.env.INPUT_CHINESE || "true").toLowerCase() != "false"; // use chinese
const include_files = (0, utils_1.split_message)(process.env.INPUT_INCLUDE_FILES || "");
const exclude_files = (0, utils_1.split_message)(process.env.INPUT_EXCLUDE_FILES || "");
const system_prompt = (0, prompt_1.take_system_prompt)(useChinese);
// 获取输入参数
const url = process.env.INPUT_HOST; // INPUT_HOST 是从 action.yml 中定义的输入
if (!url) {
    console.error('HOST input is required.');
    process.exit(1); // 退出程序，返回错误代码
}
const model = process.env.INPUT_MODEL; // INPUT_HOST 是从 action.yml 中定义的输入
if (!model) {
    console.error('model input is required.');
    process.exit(1); // 退出程序，返回错误代码
}
async function pushComments(message) {
    if (!process.env.INPUT_PULL_REQUEST_NUMBER) {
        console.log(message);
        return;
    }
    return await (0, utils_1.post)({
        url: `${process.env.GITHUB_API_URL}/repos/${process.env.INPUT_REPOSITORY}/issues/${process.env.INPUT_PULL_REQUEST_NUMBER}/comments`,
        body: { body: message },
        header: { 'Authorization': `token ${process.env.INPUT_TOKEN}` }
    });
}
async function aiGenerate({ host, token, prompt, model, system }) {
    const data = JSON.stringify({
        prompt: prompt,
        model: model,
        stream: false,
        system: system || system_prompt,
        options: {
            tfs_z: 1.5,
            top_k: 30,
            top_p: 0.8,
            temperature: 0.7,
            num_ctx: 10240,
        }
    });
    return await (0, utils_1.post)({
        url: `${host}/api/generate`,
        body: data,
        header: { 'Authorization': token ? `Bearer ${token}` : "", }
    });
}
async function aiCheckDiffContext() {
    const BASE_REF = process.env.INPUT_BASE_REF;
    try {
        (0, node_child_process_1.execSync)(`git fetch origin ${BASE_REF}`, { encoding: 'utf-8' });
        // exec git diff get diff files
        const diffOutput = (0, node_child_process_1.execSync)(`git diff --name-only origin/${BASE_REF}...HEAD`, { encoding: 'utf-8' });
        let files = diffOutput.trim().split("\n");
        for (let key in files) {
            if (!files[key])
                continue;
            console.log("check diff context:", files[key]);
            if ((include_files.length > 0) && (!(0, utils_1.doesAnyPatternMatch)(include_files, files[key]))) {
                console.log("exclude(include):", files[key]);
                continue;
            }
            else if ((exclude_files.length > 0) && ((0, utils_1.doesAnyPatternMatch)(exclude_files, files[key]))) {
                console.log("exclude(exclude):", files[key]);
                continue;
            }
            const fileDiffOutput = (0, node_child_process_1.execSync)(`git diff origin/${BASE_REF}...HEAD -- "${files[key]}"`, { encoding: 'utf-8' });
            // ai generate
            try {
                let response = await aiGenerate({
                    host: url,
                    token: process.env.INPUT_AI_TOKEN,
                    prompt: fileDiffOutput,
                    model: model,
                    system: process.env.INPUT_REVIEW_PROMPT
                });
                if (response.detail) { // noinspection ExceptionCaughtLocallyJS
                    throw response.detail;
                }
                if (!response.response) { // noinspection ExceptionCaughtLocallyJS
                    throw "ollama error";
                }
                let Review = useChinese ? "审核结果" : "Review";
                let comments = `# ${Review} \r\n${process.env.GITHUB_SERVER_URL}/${process.env.INPUT_REPOSITORY}/src/commit/${process.env.GITHUB_SHA}/${files[key]} \r\n\r\n\r\n${response.response}`;
                let resp = await pushComments(comments);
                if (!resp.id) {
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Error(useChinese ? "提交issue评论失败" : "push comment error");
                }
                console.log(useChinese ? "提交issue评论成功：" : "push comment success: ", resp.id);
            }
            catch (e) {
                console.error("aiGenerate:", e);
            }
        }
    }
    catch (error) {
        console.error('Error executing git diff:', error);
        process.exit(1); // error exit
    }
}
aiCheckDiffContext()
    .then(_ => console.log(useChinese ? "检查结束" : "review finish"))
    .catch(e => {
    console.error(useChinese ? "检查失败:" : "review error", e);
    process.exit(1);
});
