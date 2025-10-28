const path = require("path");
const { spawn } = require("child_process");

exports.handler = async (event, context) => {
  console.log("🚀 Direct Lambda handler starting...");

  return new Promise((resolve, reject) => {
    const bunPath = path.join(__dirname, "index.ts");

    const bun = spawn("bun", ["run", bunPath], {
      stdio: "inherit",
      env: { ...process.env, AWS_LAMBDA_EVENT: JSON.stringify(event) }
    });

    bun.on("close", (code) => {
      console.log(`Bun process exited with code: ${code}`);
      if (code === 0) {
        resolve({
          statusCode: 200,
          body: JSON.stringify({ message: "Success", code })
        });
      } else {
        reject(new Error(`Bun exited with code ${code}`));
      }
    });

    bun.on("error", (error) => {
      console.error("Spawn error:", error);
      reject(error);
    });
  });
};