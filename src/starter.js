require("dotenv/config");
const path = require("path");
const { spawn } = require("child_process");

exports.handler = async (event, context) => {
  console.log("🚀 Direct Lambda handler starting...");

  return new Promise((resolve, reject) => {
    const bunPath = path.join(__dirname, "index.ts");

    const bun = spawn("bun", ["run", bunPath], {
      stdio: ["inherit", "pipe", "pipe"],
      env: { ...process.env, AWS_LAMBDA_EVENT: JSON.stringify(event) }
    });

    let stdout = "";
    let stderr = "";

    bun.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    bun.stderr.on("data", (data) => {
      const dataStr = data.toString();
      stderr += dataStr;
      console.error(dataStr);
    });

    bun.on("close", (code) => {
      console.log(`Bun process exited with code: ${code}`);

      const resultMatch = stdout.match(/===BUN_RESULT_START===\n([\s\S]*?)\n===BUN_RESULT_END===/);

      if (resultMatch) {
        try {
          const result = JSON.parse(resultMatch[1].trim());

          if (code === 0) {
            resolve(result);
          } else {
            if (result.statusCode >= 400) {
              reject(new Error(result.body || `Bun exited with code ${code}`));
            } else {
              resolve(result);
            }
          }
        } catch (parseError) {
          console.error("Failed to parse Bun output:", resultMatch[1]);
          console.error("Parse error:", parseError);
          if (code === 0) {
            resolve({
              statusCode: 200,
              body: JSON.stringify({ message: "Success", code })
            });
          } else {
            reject(new Error(`Bun exited with code ${code}. Failed to parse output`));
          }
        }
      } else {
        if (code === 0) {
          console.warn("No result found in Bun output, but exit code was 0");
          resolve({
            statusCode: 200,
            body: JSON.stringify({ message: "Success", code, output: stdout.substring(0, 100) })
          });
        } else {
          reject(new Error(`Bun exited with code ${code}. No result found. Stderr: ${stderr || "No error output"}`));
        }
      }
    });

    bun.on("error", (error) => {
      console.error("Spawn error:", error);
      reject(error);
    });
  });
};