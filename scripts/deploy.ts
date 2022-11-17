/* eslint-disable prefer-const */
/* eslint-disable camelcase */
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, run, network, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import dotenv from "dotenv";
import moment from "moment";
import chai from "chai";
import {
  USDC__factory,
  USDC,
  CalculumVault__factory,
  CalculumVault,
  MockUpOracle,
  MockUpOracle__factory,
  // eslint-disable-next-line node/no-missing-import
} from "../typechain-types";

dotenv.config();

const { expect } = chai;

const snooze = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms));

let OracleFactory: MockUpOracle__factory;
let Oracle: MockUpOracle;
let traderBotWallet: SignerWithAddress;
let treasuryWallet: SignerWithAddress;
let transferBotRoleAddress: SignerWithAddress;
const name = "CalculumUSDC1";
const symbol = "calcUSDC1";
const decimals = 18;
const EPOCH_TIME: moment.Moment = moment();

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await run("compile");
  const provider = network.provider;
  const accounts: SignerWithAddress[] = await ethers.getSigners();
  // Getting from command Line de Contract Name
  // Getting from command Line de Contract Name
  const contractName: string = "CalculumVault";
  const EPOCH_START = EPOCH_TIME.utc(false).unix();
  console.log(`Contract Name: ${contractName}`);
  const EPOCH_START = EPOCH_TIME.utc(false).unix();
  const accounts = await ethers.getSigners();
  const deployer = accounts[0];
  traderBotWallet = accounts[1];
  treasuryWallet = accounts[2];
  transferBotRoleAddress = accounts[3];
  let USDCFactory: USDC__factory;
  let USDc: USDC;
  let CalculumFactory: CalculumVault__factory;
  let Calculum: CalculumVault;
  // USD Testnet Deployer
  USDCFactory = (await ethers.getContractFactory(
    "USDC",
    accounts[0]
  )) as USDC__factory;
  // Deploy Stable coin Mockup
  USDc = (await USDCFactory.deploy()) as USDC;
  await USDc.deployed();
  await snooze(10000);
  // eslint-disable-next-line no-unused-expressions
  expect(USDc.address).to.properAddress;
  console.log(`USDC Address: ${USDc.address}`);
  // Deploy Mockup Oracle
  OracleFactory = (await ethers.getContractFactory(
    "MockUpOracle",
    deployer
  )) as MockUpOracle__factory;
  // Deploy Oracle
  Oracle = (await OracleFactory.deploy(
    traderBotWallet.address,
    USDc.address
  )) as MockUpOracle;
  await Oracle.deployed();
  await snooze(10000);
  // eslint-disable-next-line no-unused-expressions
  expect(Oracle.address).to.properAddress;
  console.log(`Oracle Address: ${Oracle.address}`);
  await snooze(10000);
  // We get the contract to deploy
  CalculumFactory = (await ethers.getContractFactory(
    contractName,
    deployer
  )) as CalculumVault__factory;
  Calculum = (await upgrades.deployProxy(
    CalculumFactory,
    [
      name,
      symbol,
      decimals,
      USDc.address,
      Oracle.address,
      traderBotWallet.address,
      treasuryWallet.address,
      transferBotRoleAddress.address,
      [
        EPOCH_START,
        300 * 10 ** 6,
        10000 * 10 ** 6,
        ethers.utils.parseEther("50000"),
      ],
    ],
    {
      kind: "transparent",
    }
  )) as CalculumVault;

  console.log("Calculum Vault deployed to:", Calculum.address);

  // Setting the Value of Epoch Duration and Maintenance Time Before and After
  await Calculum.connect(deployer).setEpochDuration(
    epochDuration,
    maintTimeBefore,
    maintTimeAfter
  );

  // Verify Process ERC20 Token
  if (network.name !== "hardhat") {
    console.log("Start verifying the Implementation Smart Contract");
    await snooze(60000);
    const currentImplAddress = await getImplementationAddress(
      provider,
      Calculum.address
    );
    console.log(`Current Implementation Address: ${currentImplAddress}`);
    await snooze(60000);
    await run("verify:verify", {
      address: currentImplAddress,
      constructorArguments: [],
      contract: `contracts/${contractName}.sol:${contractName}`,
    });
    // USDC Token
    await run("verify:verify", {
      address: USDc.address,
      constructorArguments: [],
      contract: `contracts/USDC.sol:USDC`,
    });
    // Oracle
    await snooze(60000);
    await run("verify:verify", {
      address: Oracle.address,
      constructorArguments: [traderBotWallet.address, USDc.address],
      contract: `contracts/mock/MockUpOracle.sol:MockUpOracle`,
    });
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
