/**
 * Simple JavaScript example demonstrating authentication with private WebSockets channels.
 */

import { DydxClient } from "@dydxprotocol/v3-client";
import { RequestMethod } from "@dydxprotocol/v3-client/build/src/lib/axios/types";
import Web3 from "web3";
import WebSocket from "ws";
import dotenv from "dotenv";
// import chai from "chai";

dotenv.config();

// const { expect } = chai;

// const snooze = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms));

const HTTP_HOST_TESTNET =
  process.env.HTTP_HOST_TESTNET || "https://api.stage.dydx.exchange";
const WS_HOST_TESTNET =
  process.env.WS_HOST_TESTNET || "wss://api.stage.dydx.exchange/v3/ws";
const ETHEREUM_PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// NOTE: Set up web3 however your prefer to authenticate to your Ethereum account.
const ethNetwork = `https://ropsten.infura.io/v3/` + process.env.INFURAKEY;
const provider = new Web3.providers.HttpProvider(ethNetwork);
const web3 = new Web3(provider);
web3.eth.accounts.wallet.add(ETHEREUM_PRIVATE_KEY);

(async () => {
  const client = new DydxClient(HTTP_HOST_TESTNET, {
    networkId: 3,
    web3: web3,
  });
  const apiCreds = await client.onboarding.recoverDefaultApiCredentials(
    web3.eth.accounts.wallet[0].address
  );
  client.apiKeyCredentials = apiCreds;

  const timestamp = new Date().toISOString();
  const signature = client.private.sign({
    requestPath: "/ws/accounts",
    method: RequestMethod.GET,
    isoTimestamp: timestamp,
  });
  const msg = {
    type: "subscribe",
    channel: "v3_accounts",
    accountNumber: "0",
    apiKey: apiCreds.key,
    signature,
    timestamp,
    passphrase: apiCreds.passphrase,
  };

  const ws = new WebSocket(WS_HOST_TESTNET);

  ws.on("message", (message: any) => {
    console.log("<", message);
  });

  ws.on("open", () => {
    console.log(">", msg);
    ws.send(JSON.stringify(msg));
  });

  ws.on("error", (error: any) => {
    console.log("<", error);
  });

  ws.on("close", () => {
    console.log("Connection closed");
  });
})()
  .then(() => console.log("Done"))
  .catch(console.error);
