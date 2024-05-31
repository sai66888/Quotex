const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

let option = {
  amount: 1,
  time: 5,
  action: "call",
  isDemo: 1,
  tournamentId: 0,
  requestId: 1713314207,
  optionType: 100,
  loopIt: "Infinity",
};

let openTradeCount = 0;
let lossStreakCount = 0;
let countgoal = 1;
let reached = false;
let up = false;
let dummy = true;
let browser;
let page;

async function initializeBrowser() {
  const extensionPath = path.resolve(__dirname, "inject file");
  browser = await puppeteer.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    timeout: 0, // Disable timeout
    protocolTimeout: 120000, // Set protocol timeout to 2 minutes
  });

  try {
    const browserWSEndpoint = browser.wsEndpoint();
    fs.writeFileSync("browserWSEndpoint.txt", browserWSEndpoint);

    const pages = await browser.pages();
    page = await browser.newPage();
    pages[0].close();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36"
    );

    const cookieData = fs.readFileSync("Cookies.json");
    const customCookies = JSON.parse(cookieData);

    for (const cookie of customCookies) {
      await page.setCookie(cookie);
    }

    await page.exposeFunction("notify", (msg) => {
      console.log(msg);
      if (msg.state == "open" && msg.connected == true) {
        // console.log("Send request for runcode");
      }
    });

    await page.goto("https://qxbroker.com/en/demo-trade");

    await page.waitForFunction(() => window.WebSocket);
    await page.waitForFunction(() => window.trackedWebSockets);

    await page.exposeFunction("runcode", (msg) => {
      if (msg.state == "runcode") {
        console.log(msg.data);
      }
    });

    await page.waitForSelector(
      ".trading-chart__assets .asset-select button.asset-select__button"
    );
    await page.evaluate(() => {
      window.openTradeCount = 0;
      window.lossStreakCount = 0;
      window.countgoal = 1;
      window.reached = false;
      window.up = false;
      window.dummy = true;
      window.isGoToNext = false;
      window.tradeWining = {};
    });
  } catch (error) {
    await browser.close();
  } finally {
    await browser.close();
  }
}

async function runAndLoggedIn() {
  try {
    await initializeBrowser();

    page.on("console", async (msg) => {
      const type = msg.type();
      if (type === "log") {
        const args = await Promise.all(
          msg.args().map((arg) => arg.jsonValue())
        );
        let formattedArgs = args.map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : arg
        );

        if (
          formattedArgs.some((arg) => {
            if (typeof arg === "string") {
              try {
                const obj = JSON.parse(arg);
                return (
                  obj &&
                  obj.data &&
                  obj.data.deals &&
                  Array.isArray(obj.data.deals)
                );
              } catch (error) {
                return false;
              }
            }
            return false;
          })
        ) {
          let output = [...formattedArgs];
          output = JSON.parse(output[0]);

          console.log(`Your profit is ${output.data.profit}`);
          await page.evaluate((output) => {
            window.isGoToNext = true;
            window.tradeWining = output;
            openTradeCount = 0;
          }, output);
        }
      }
    });

    await findHighestYieldAssetAndTrade();
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function findHighestYieldAssetAndTrade() {
  let highestRowJson = { name: null };
  await page.click(
    ".trading-chart__assets .asset-select button.asset-select__button"
  );

  highestRowJson = await page.evaluate((highestRowJson) => {
    const rows = document.querySelectorAll(".assets-table__item");
    let maxRev = -Infinity;
    let maxRevRow = null;

    rows.forEach((row) => {
      const revFrom1Min = parseFloat(
        row.querySelector(".assets-table__percent.payoutOne span").textContent
      );
      if (revFrom1Min > maxRev) {
        maxRev = revFrom1Min;
        maxRevRow = row;
      }
    });

    if (maxRevRow) {
      maxRevRow.querySelector(".assets-table__name").click();
      let name = maxRevRow.querySelector(
        ".assets-table__name span"
      ).textContent;
      let change = maxRevRow.querySelector(
        ".assets-table__change span"
      ).textContent;
      let revFrom1Min = parseFloat(
        maxRevRow.querySelector(".assets-table__percent.payoutOne span")
          .textContent
      );

      highestRowJson = { name, change, "Rev. from 1 min": revFrom1Min };
      return highestRowJson;
    }

    return false;
  }, highestRowJson);

  if (highestRowJson === false) {
    console.log(
      "Could not find the highest Rev. from 1 min. Please run your script again"
    );
    return;
  }

  console.log("Detected the highest Rev. from 1 min", highestRowJson);

  highestRowJson.name = highestRowJson.name
    ?.replace("/", "")
    .replace(" (OTC)", "_otc");
  if (highestRowJson.name === "USDBRL_otc") highestRowJson.name = "BRLUSD_otc";

  let wsSendData = ["orders/open", { asset: highestRowJson.name, ...option }];
  await sleep(1000);

  await page.evaluate(
    async ({ wsSendData, option }) => {
      console.log("Received Array ", wsSendData);

      async function tradeLoop(wsObj, wsSendData, option) {
        while (true) {
          let randomNumber = Math.random();
          if (!up) {
            wsSendData[1].action = "call";
            up = true;
          } else {
            wsSendData[1].action = "put";
            up = false;
          }
          if (reached) {
            wsSendData[1].amount = 100;
            reached = false;
          } else {
            wsSendData[1].amount = 1;
          }

          let dataSend = "42" + JSON.stringify(wsSendData);
          wsObj.ws.send(dataSend);
          openTradeCount = 1;
          window.runcode({
            state: "runcode",
            data: "\n\n\nTrade placed successfully. Waiting for result...",
          });
          openTradeCount = 1;
          while (openTradeCount === 1 && !window.isGoToNext) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          let winingTrade = window.tradeWining || {};
          window.isGoToNext = false;
          if (winingTrade.data.profit - option.amount < 0) {
            lossStreakCount++;
            if (lossStreakCount === 11) {
              reached = true;
              lossStreakCount = 0;
            } else {
              reached = false;
              option.amount = 1;
            }
          } else {
            reached = false;
            lossStreakCount = 0;
            option.amount = 1;
          }
        }
      }

      for (let key in trackedWebSockets) {
        let wsObj = trackedWebSockets[key];

        // Simulate WebSocket disconnection after 30 seconds
        setTimeout(() => {
          console.log("Simulating WebSocket disconnection");
          wsObj.ws.close();
        }, 30000);

        wsObj.ws.onclose = () => {
          console.log(`WebSocket ${key} closed`);
          reconnect();
        };

        if (option.loopIt === "Infinity") {
          tradeLoop(wsObj, wsSendData, option).catch((err) =>
            window.runcode({
              state: "runcode",
              data: "\nError in tradeLoop:" + err,
            })
          );
        } else {
          for (let index = 0; index < option.loopIt; index++) {
            wsObj.ws.send(wsSendData);

            window.runcode({
              state: "runcode",
              data: "\n\n\nTrade placed successfully. Waiting for result...",
            });

            while (!window.isGoToNext) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            window.isGoToNext = false;
          }
        }
      }
    },
    { wsSendData, option }
  );
}

function reconnect() {
  setTimeout(async () => {
    try {
      window.runcode({
        state: "runcode",
        data: "\n\n\nAttempting to reconnect...",
      });

      await runAndLoggedIn();

      window.runcode({
        state: "runcode",
        data: "\n\n\nReconnected successfully",
      });
    } catch (error) {
      console.error("Reconnect attempt failed:", error);
      reconnect();
    }
  }, 5000); // Wait 5 seconds before reconnecting
}

runAndLoggedIn();

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};
