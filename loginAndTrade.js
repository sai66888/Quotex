const fs = require("fs");
const { page, openTradeCount, findHighestYieldAssetAndTrade } = require(".");

// Log in to the trading platform and start the trading loop

async function loginAndTrade() {
  try {
    const cookieData = fs.readFileSync("Cookies.json");
    const customCookies = JSON.parse(cookieData);

    for (const cookie of customCookies) {
      await page.setCookie(cookie);
    }

    await page.exposeFunction("notify", (msg) => {
      console.log(msg);
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
exports.loginAndTrade = loginAndTrade;
