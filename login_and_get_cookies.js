const puppeteer = require("puppeteer");
const fs = require("fs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function loginAndGetCookies() {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  try {
    // Open the webpage
    await page.goto("https://qxbroker.com/en/sign-in");

    // Wait until the webpage is fully loaded
    await page.waitForSelector("button", { visible: true });

    // Wait for the email input field to appear and enter the email
    await page.waitForSelector(
      "#tab-1 form .modal-sign__input input.modal-sign__input-value[type='email']"
    );
    await page.waitForSelector(
      "#tab-1 form .modal-sign__input input.modal-sign__input-value[type='password']"
    );
    await page.waitForSelector("#tab-1 form button.modal-sign__block-button");
    await page.type(
      "#tab-1 form .modal-sign__input input.modal-sign__input-value[type='email",
      "mkharoof84@gmail.com"
    );

    await page.type(
      "#tab-1 form .modal-sign__input input.modal-sign__input-value[type='password']",
      "Yazan@5555"
    );

    await page.click("#tab-1 form button.modal-sign__block-button");

    // Wait for navigation to the top page
    await page.waitForNavigation();

    let currentPageUrl = page.url();

    await handlePageUrl(currentPageUrl);

    async function handlePageUrl(currentPageUrl) {
      if (currentPageUrl == "https://qxbroker.com/en/sign-in/") {
        console.log("You are on the login page.");
        const otpInputExists = await page.evaluate(() => {
          return !!document.querySelector(
            "form input.input-control-cabinet__input"
          );
        });

        if (otpInputExists) {
          console.log("You are on the OTP page.");
          rl.question("Enter OTP: ", async (otp) => {
            console.log(`You entered: ${otp}`);

            await page.type("form input.input-control-cabinet__input", otp);
            await page.click(
              ".auth__submit button.button.button--primary.button--spaced"
            );

            await page.waitForNavigation();
            currentPageUrl = page.url();
            console.log("OTP submitted successfully.");
            await handlePageUrl(currentPageUrl);
            rl.close();
          });
        } else {
          console.log("You are on an unknown page.");
        }
      } else {
        // Get the cookies
        const cookies = await page.cookies();

        // Save cookies to a JSON file
        const outputFilePath = "Cookies.json";
        fs.writeFileSync(outputFilePath, JSON.stringify(cookies, null, 2));

        console.log("Cookies have been saved to Cookies.json successfully.");
      }
    }
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await browser.close();
  }
}

loginAndGetCookies();

setInterval(loginAndGetCookies, 1 * 60 * 60 * 1000);

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};
