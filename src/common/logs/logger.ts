const logLevel = Bun.env.LOG_LEVEL || "info";
import { safeStringify } from "../utils";

export class Logger {
  private readonly prefix: string;

  private readonly redColor = "\x1b[31m";
  private readonly greenColor = "\x1b[32m";
  private readonly yellowColor = "\x1b[33m";
  private readonly blueColor = "\x1b[34m";
  private readonly cyanColor = "\x1b[36m";
  private readonly whiteColor = "\x1b[37m";

  constructor(name: string) {
    this.prefix = `[${name}]`;
  }

  private formatTime(): string {
    return new Date().toISOString();
  }

  callLog(functionName: string, ...args: any[]): void {
    const functionNameColor = this.greenColor;
    const timeColor = this.yellowColor;
    const argsColor = this.blueColor;

    console.log(
      `${
        this.prefix
      } [${timeColor}${this.formatTime()}] (function: ${functionNameColor}${functionName}${
        this.whiteColor
      }) called with : ${argsColor}${safeStringify(args)}${this.whiteColor}`
    );
  }

  returnLog(functionName: string, ...args: any[]): void {
    const functionNameColor = this.greenColor;
    const timeColor = this.yellowColor;
    const argsColor = this.blueColor;

    console.log(
      `${
        this.prefix
      } [${timeColor}${this.formatTime()}] (function: ${functionNameColor}${functionName}${
        this.whiteColor
      }) returned : ${argsColor}${safeStringify(args)}${this.whiteColor}`
    );
  }

  info(message: string, ...args: any[]): void {
    const messageColor = this.greenColor;
    const timeColor = this.yellowColor;

    console.log(
      `${
        this.prefix
      } [${timeColor}${this.formatTime()}] [INFO] ${messageColor}${safeStringify(
        message
      )}${this.whiteColor}`,
      ...args
    );
  }

  error(message: string, error?: any): void {
    const messageColor = this.redColor;
    const timeColor = this.yellowColor;

    console.error(
      `${
        this.prefix
      } [${timeColor}${this.formatTime()}] [ERROR] ${messageColor}${message}${
        this.whiteColor
      }`,
      error || ""
    );
  }

  warn(message: string, ...args: any[]): void {
    const messageColor = this.yellowColor;
    const timeColor = this.yellowColor;

    console.warn(
      `${
        this.prefix
      } [${timeColor}${this.formatTime()}] [WARN] ${messageColor}${message}${
        this.whiteColor
      }`,
      ...args
    );
  }

  debug(message: string, ...args: any[]): void {
    if (logLevel !== "debug") {
      return;
    }
    const messageColor = this.cyanColor;
    const timeColor = this.yellowColor;

    console.debug(
      `${
        this.prefix
      } [${timeColor}${this.formatTime()}] [DEBUG] ${messageColor}${message}${
        this.whiteColor
      }`,
      ...args
    );
  }
}
