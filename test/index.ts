/* eslint-disable no-unused-vars */
/* eslint-disable camelcase */
import { ethers, run, network, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import fetch from "node-fetch";
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

// General Vars
let deployer: SignerWithAddress;
let treasuryWallet: SignerWithAddress;
let traderBotWallet: SignerWithAddress;
let transferBotRoleAddress: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let carla: SignerWithAddress;
let lastdeployer: SignerWithAddress;
let OracleFactory: MockUpOracle__factory;
let Oracle: MockUpOracle;
let USDCFactory: USDC__factory;
let USDc: USDC;
let CalculumFactory: CalculumVault__factory;
let Calculum: CalculumVault;
// eslint-disable-next-line prefer-const
const name = "CalculumUSDC1";
const symbol = "calcUSDC1";
const decimals = 18;
const EPOCH_TIME: moment.Moment = moment();
const epochDuration = 60 * 60 * 24 * 7;
const maintTimeBefore = 60 * 60;
const maintTimeAfter = 30 * 60;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const snooze = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Verification of Basic Value and Features", function () {
  const EPOCH_START = EPOCH_TIME.utc(false).unix();
  let currentEpoch: moment.Moment;
  let nextEpoch: moment.Moment;
  before(async () => {
    [
      deployer,
      treasuryWallet,
      traderBotWallet,
      transferBotRoleAddress,
      alice,
      bob,
      carla,
      lastdeployer,
    ] = await ethers.getSigners();
    await run("compile");
    // Getting from command Line de Contract Name
    const contractName: string = "CalculumVault";

    console.log(`Contract Name: ${contractName}`);
    const accounts = await ethers.getSigners();

    // USD Local Testnet Deployer
    USDCFactory = (await ethers.getContractFactory(
      "USDC",
      deployer
    )) as USDC__factory;
    // Deploy Stable coin Mockup
    USDc = (await USDCFactory.deploy()) as USDC;
    // eslint-disable-next-line no-unused-expressions
    expect(USDc.address).to.properAddress;
    console.log(`USDC Address: ${USDc.address}`);
    // Mint 100 K Stable coin to deployer, user1, user2, user3
    await USDc.mint(deployer.address, 2000000 * 10 ** 6);
    await USDc.mint(alice.address, 100000 * 10 ** 6);
    await USDc.mint(bob.address, 100000 * 10 ** 6);
    await USDc.mint(carla.address, 100000 * 10 ** 6);

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
    // eslint-disable-next-line no-unused-expressions
    expect(Oracle.address).to.properAddress;
    console.log(`Oracle Address: ${Oracle.address}`);
    // Calculum Vault Deployer
    CalculumFactory = (await ethers.getContractFactory(
      contractName,
      deployer
    )) as CalculumVault__factory;
    // Deploy Calculum Vault
    Calculum = (await upgrades.deployProxy(CalculumFactory, [
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
    ])) as CalculumVault;
    // eslint-disable-next-line no-unused-expressions
    expect(Calculum.address).to.properAddress;
    console.log(`Calculum Address: ${Calculum.address}`);
    // Allowance the Contract in Stable Coin
    await USDc.connect(deployer).approve(Calculum.address, 100000000 * 10 ** 6);
    await USDc.connect(alice).approve(Calculum.address, 100000000 * 10 ** 6);
    await USDc.connect(bob).approve(Calculum.address, 100000000 * 10 ** 6);
    await USDc.connect(carla).approve(Calculum.address, 100000000 * 10 ** 6);
    await USDc.connect(transferBotRoleAddress).approve(
      Calculum.address,
      100000000 * 10 ** 6
    );
    await USDc.connect(traderBotWallet).approve(
      Calculum.address,
      100000000 * 10 ** 6
    );
    console.log(`EPOCH_START : ${EPOCH_START}`);
    console.log(
      "Epoch Start Full Date: " +
        moment(EPOCH_TIME.utc(false).unix() * 1000)
          .utc()
          .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
  });

  beforeEach(async () => {
    await network.provider.send("evm_mine", []);
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    console.log(
      "Verify TimeStamp: ",
      time,
      " Full Date: ",
      moment(time * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
  });

  //   ** Validate Initial Value */
  //   ** 1. Validate Initial Value */
  //   ** t1. Validate Initial Value*/
  it("1.- Validate Initial Value", async () => {
    console.log("Validate Initial Values");
    // Verify Owner
    expect(await Calculum.owner()).to.equal(deployer.address);
    // Verify name ERC Vault
    expect(await Calculum.name()).to.equal(name);
    // Verify symbol ERC Vault
    expect(await Calculum.symbol()).to.equal(symbol);
    // Verify decimals ERC Vault
    expect(await Calculum.decimals()).to.equal(decimals);
    // Verify assets of Vault
    expect(await Calculum.asset()).to.equal(USDc.address);
    // Verify Treasury Address
    expect(await Calculum.treasuryWallet()).to.equal(treasuryWallet.address);
    // Verify Oracle Address
    expect(await Calculum.oracle()).to.equal(Oracle.address);
    // Verify Trader Bot Address
    expect(await Calculum.traderBotWallet()).to.equal(traderBotWallet.address);
    // Verify Initial Value of Percentage Maintenance Fee
    expect(await Calculum.MANAGEMENT_FEE_PERCENTAGE()).to.equal(
      ethers.utils.parseEther("0.01")
    );
    // Verify Initial Value of Percentage Performance Fee
    expect(await Calculum.PERFORMANCE_FEE_PERCENTAGE()).to.equal(
      ethers.utils.parseEther("0.15")
    );
    // Verify Epoch Start
    expect(await Calculum.EPOCH_START()).to.equal(EPOCH_START);
    // Verify Epoch Duration
    expect(await Calculum.EPOCH_DURATION()).to.equal(epochDuration);
    // Verify Maint Time Before
    expect(await Calculum.MAINTENANCE_PERIOD_PRE_START()).to.equal(
      maintTimeBefore
    );
    // Verify Maint Time After
    expect(await Calculum.MAINTENANCE_PERIOD_POST_START()).to.equal(
      maintTimeAfter
    );
    // Verify Min Deposit
    expect(await Calculum.MIN_DEPOSIT()).to.equal(300 * 10 ** 6);
    // Verify Max Deposit
    expect(await Calculum.MAX_DEPOSIT()).to.equal(10000 * 10 ** 6);
    // Verify Max Total Vaul
    expect(await Calculum.MAX_TOTAL_SUPPLY()).to.equal(
      ethers.utils.parseEther("50000")
    );
  });

  //   ** Verification of Sequence of Epoch */
  //   ** 2. Verification of Sequence of Epoch */
  //   ** t1. Verification of Sequence of Epoch*/
  it("2.- Verification of Sequence of Epoch", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(deployer).setEpochDuration(
        epochDuration,
        maintTimeBefore,
        maintTimeAfter
      )
    ).to.revertedWith(
      `VaultInMaintenance("${deployer.address}", ${timestamp + 1})`
    );
    // Move to after the Maintenance Time Post Maintenance
    const move1: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move1.add(maintTimeAfter + 100, "s").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Add ${maintTimeAfter + 100} seconds: `,
      move1,
      " Full Date: ",
      moment(move1.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    let currentEpoch: moment.Moment = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    let nextEpoch: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
    // Setting the Value of Epoch Duration and Maintenance Time Before and After
    await Calculum.connect(deployer).setEpochDuration(
      epochDuration,
      maintTimeBefore,
      maintTimeAfter
    );
    // Move to after Finalize the Next Epoch (2nd Epoch)
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(EPOCH_TIME.utc(false).add(epochDuration, "s").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    const move2: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    console.log(
      `Verify TimeStamp after Add ${epochDuration} seconds: `,
      move2,
      " Full Date: ",
      moment(move2.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    console.log(
      `Number of Current Epoch Before: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    await Calculum.CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch After: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    await Calculum.CurrentEpoch();
    console.log(
      `Number of Current Epoch Second Time (Verification not Changes): ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    await Calculum.CurrentEpoch();
    console.log(
      `Number of Current Epoch Third Time (Verification not Changes): ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    await Calculum.CurrentEpoch();
    console.log(
      `Number of Current Epoch Forth Time (Verification not Changes): ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch (2nd): ", currentEpoch);
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch (3rd): ", nextEpoch);

    // Move to after Finalize the Next Epoch (3rd Epoch)
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(EPOCH_TIME.utc(false).add(epochDuration, "s").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    const move3: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    console.log(
      `Verify TimeStamp after Add ${epochDuration} seconds: `,
      move3,
      " Full Date: ",
      moment(move3.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    await Calculum.CurrentEpoch();
    console.log(
      "Verification of Third Epoch: ",
      parseInt((await Calculum.CURRENT_EPOCH()).toString())
    );
    await Calculum.CurrentEpoch();
    console.log(
      "Verification of Third Epoch second time (Verification not changes): ",
      parseInt((await Calculum.CURRENT_EPOCH()).toString())
    );
    await Calculum.CurrentEpoch();
    console.log(
      "Verification of Third Epoch Third time (Verification not changes): ",
      parseInt((await Calculum.CURRENT_EPOCH()).toString())
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  //   ** Transfer / Renounce OwnerShip */
  //   ** 3. Transfer / Renounce OwnerShip */
  //   ** t1. Transfer / Renounce OwnerShip */
  it("3.- Transfer / Renounce OwnerShip", async () => {
    await Calculum.connect(deployer).transferOwnership(lastdeployer.address);
    expect(await Calculum.owner()).to.equal(lastdeployer.address);
    await Calculum.connect(lastdeployer).renounceOwnership();
    expect(await Calculum.owner()).to.equal(ZERO_ADDRESS);
  });

  after(async () => {
    await network.provider.send("evm_mine", []);
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    console.log(
      "Verify TimeStamp: ",
      time,
      " Full Date: ",
      moment(time * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
  });
});

describe("Check Standard Work Flow of the Value Based on Excel", function () {
  let EPOCH_START: number;
  let currentEpoch: moment.Moment;
  let nextEpoch: moment.Moment;
  before(async () => {
    [
      deployer,
      treasuryWallet,
      traderBotWallet,
      transferBotRoleAddress,
      alice,
      bob,
      carla,
      lastdeployer,
    ] = await ethers.getSigners();
    await run("compile");
    // Getting from command Line de Contract Name
    const contractName: string = "CalculumVault";

    console.log(`Contract Name: ${contractName}`);
    const accounts = await ethers.getSigners();

    // USD Local Testnet Deployer
    USDCFactory = (await ethers.getContractFactory(
      "USDC",
      deployer
    )) as USDC__factory;
    // Deploy Stable coin Mockup
    USDc = (await USDCFactory.deploy()) as USDC;
    // eslint-disable-next-line no-unused-expressions
    expect(USDc.address).to.properAddress;
    console.log(`USDC Address: ${USDc.address}`);
    // Mint 100 K Stable coin to deployer, user1, user2, user3
    await USDc.mint(deployer.address, 2000000 * 10 ** 6);
    await USDc.mint(alice.address, 100000 * 10 ** 6);
    await USDc.mint(bob.address, 100000 * 10 ** 6);
    await USDc.mint(carla.address, 100000 * 10 ** 6);

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
    // eslint-disable-next-line no-unused-expressions
    expect(Oracle.address).to.properAddress;
    console.log(`Oracle Address: ${Oracle.address}`);
    // Calculum Vault Deployer
    CalculumFactory = (await ethers.getContractFactory(
      contractName,
      deployer
    )) as CalculumVault__factory;
    // Deploy Calculum Vault
    EPOCH_START = EPOCH_TIME.utc(false).unix();
    Calculum = (await upgrades.deployProxy(CalculumFactory, [
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
    ])) as CalculumVault;
    // eslint-disable-next-line no-unused-expressions
    expect(Calculum.address).to.properAddress;
    console.log(`Calculum Address: ${Calculum.address}`);
    // fetch call for send Calculum Address to endpoint localhost:3000/set/contract by post call with body {"contractAddress":"0x2d13826359803522cCe7a4Cfa2c1b582303DD0B4"}
    const response = await fetch("http://localhost:3000/set/contract", {
      method: "POST",
      body: JSON.stringify({ contractAddress: Calculum.address }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    console.log(data);
    expect(data.contractAddress).to.equal(Calculum.address);
    // Allowance the Contract in Stable Coin
    await USDc.connect(deployer).approve(Calculum.address, 100000000 * 10 ** 6);
    await USDc.connect(alice).approve(Calculum.address, 100000000 * 10 ** 6);
    await USDc.connect(bob).approve(Calculum.address, 100000000 * 10 ** 6);
    await USDc.connect(carla).approve(Calculum.address, 100000000 * 10 ** 6);
    await USDc.connect(transferBotRoleAddress).approve(
      Calculum.address,
      100000000 * 10 ** 6
    );
    await USDc.connect(traderBotWallet).approve(
      Calculum.address,
      100000000 * 10 ** 6
    );
    console.log(`EPOCH_START: ${EPOCH_START}`);
    console.log(
      "Epoch Start Full Date: " +
        moment(EPOCH_TIME.utc(false).unix() * 1000)
          .utc()
          .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
  });

  beforeEach(async () => {
    await network.provider.send("evm_mine", []);
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    console.log(
      "Verify TimeStamp: ",
      time,
      " Full Date: ",
      moment(time * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    console.log(
      "Treasury Balance: ",
      parseInt((await USDc.balanceOf(treasuryWallet.address)).toString()) /
        10 ** 6
    );
    console.log(
      "Total Supply fo Vault: ",
      parseInt((await Calculum.totalSupply()).toString()) / 10 ** 18
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
    // List of Events
    const eventPreDeposit = Calculum.filters.PendingDeposit();
    const eventPreWithdraw = Calculum.filters.PendingWithdraw();
    const eventDeposit = Calculum.filters.Deposit();
    const eventWithdraw = Calculum.filters.Withdraw();
    const eventsPreDeposit = await Calculum.queryFilter(eventPreDeposit);
    const eventsPreWithdraw = await Calculum.queryFilter(eventPreWithdraw);
    const eventsDeposit = await Calculum.queryFilter(eventDeposit);
    const eventsWithdraw = await Calculum.queryFilter(eventWithdraw);
    console.log(
      "Pending Deposit Events: ",
      eventsPreDeposit.map((x) => {
        return {
          caller: x.args?.caller,
          receiver: x.args?.receiver,
          assets: parseInt(x.args?.assets.toString()) / 1e6,
          estimationOfShares:
            parseInt(x.args?.estimationOfShares.toString()) / 1e18,
        };
      })
    );
    console.log(
      "Pending Withdraw Events: ",
      eventsPreWithdraw.map((x) => {
        return {
          receiver: x.args?.receiver,
          owner: x.args?.owner,
          assets: parseInt(x.args?.assets.toString()) / 1e6,
          estimationOfShares:
            parseInt(x.args?.estimationOfShares.toString()) / 1e18,
        };
      })
    );
    console.log(
      "Deposit Events: ",
      eventsDeposit.map((x) => {
        return {
          caller: x.args?.caller,
          owner: x.args?.owner,
          totalAssets: parseInt(x.args?.totalAssets.toString()) / 1e6,
          shares: parseInt(x.args?.shares.toString()) / 1e18,
        };
      })
    );
    console.log(
      "Withdraw Events: ",
      eventsWithdraw.map((x) => {
        return {
          caller: x.args?.caller,
          receiver: x.args?.receiver,
          owner: x.args?.owner,
          assets: parseInt(x.args?.assets.toString()) / 1e6,
          shares: parseInt(x.args?.shares.toString()) / 1e18,
        };
      })
    );
  });

  //   ** Validate Initial Value */
  //   ** 1. Validate Initial Value */
  //   ** t1. Validate Initial Value*/
  it("1.- Validate Initial Value", async () => {
    console.log("Validate Initial Values");
    // Verify Owner
    expect(await Calculum.owner()).to.equal(deployer.address);
    // Verify name ERC Vault
    expect(await Calculum.name()).to.equal(name);
    // Verify symbol ERC Vault
    expect(await Calculum.symbol()).to.equal(symbol);
    // Verify decimals ERC Vault
    expect(await Calculum.decimals()).to.equal(decimals);
    // Verify assets of Vault
    expect(await Calculum.asset()).to.equal(USDc.address);
    // Verify Treasury Address
    expect(await Calculum.treasuryWallet()).to.equal(treasuryWallet.address);
    // Verify Oracle Address
    expect(await Calculum.oracle()).to.equal(Oracle.address);
    // Verify Trader Bot Address
    expect(await Calculum.traderBotWallet()).to.equal(traderBotWallet.address);
    // Verify Initial Value of Percentage Maintenance Fee
    expect(await Calculum.MANAGEMENT_FEE_PERCENTAGE()).to.equal(
      ethers.utils.parseEther("0.01")
    );
    // Verify Initial Value of Percentage Performance Fee
    expect(await Calculum.PERFORMANCE_FEE_PERCENTAGE()).to.equal(
      ethers.utils.parseEther("0.15")
    );
    // Verify Epoch Start
    expect(await Calculum.EPOCH_START()).to.equal(EPOCH_START);
    // Verify Epoch Duration
    expect(await Calculum.EPOCH_DURATION()).to.equal(epochDuration);
    // Verify Maint Time Before
    expect(await Calculum.MAINTENANCE_PERIOD_PRE_START()).to.equal(
      maintTimeBefore
    );
    // Verify Maint Time After
    expect(await Calculum.MAINTENANCE_PERIOD_POST_START()).to.equal(
      maintTimeAfter
    );
  });

  //   ** Verification of Sequence of First Epoch */
  //   ** 2. Verification of Sequence of First Epoch */
  //   ** t1. Alice Execute First Deposit*/
  //   ** t2. Finalize the Epoch and Transfer Amount to the Trader Bot Wallet and Treasury Wallet (fee(Maintenance and Performance))*/
  it("2.- Verification of Sequence of First Epoch (Epoch 0)", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(deployer).setEpochDuration(
        epochDuration,
        maintTimeBefore,
        maintTimeAfter
      )
    ).to.revertedWith(
      `VaultInMaintenance("${deployer.address}", ${timestamp + 1})`
    );
    // Move to after the Maintenance Time Post Maintenance
    const move1: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move1.add(maintTimeAfter, "s").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to after the Maintenance Time Post Maintenance: `,
      move1,
      " Full Date: ",
      moment(move1.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
    // Setting the Value of Epoch Duration and Maintenance Time Before and After
    await Calculum.connect(deployer).setEpochDuration(
      epochDuration,
      maintTimeBefore,
      maintTimeAfter
    );
    // Setting of Maximal Deposit
    await Calculum.connect(deployer).setInitialValue([
      300 * 10 ** 6,
      10000 * 10 ** 6,
      50000 * 10 ** 6,
    ]);
    // Verify the maximal setting of deposit
    await expect(
      Calculum.connect(alice).deposit(10001 * 10 ** 6, alice.address)
    ).to.revertedWith(
      `DepositExceededMax("${alice.address}", ${10000 * 10 ** 6})`
    );
    // Verify the minimal setting of deposit
    await expect(
      Calculum.connect(alice).deposit(299 * 10 ** 6, alice.address)
    ).to.revertedWith(
      `DepositAmountTooLow("${alice.address}", ${299 * 10 ** 6})`
    );
    // Setting the Initial Value in the Oracle of the Asset in the Vault
    await Oracle.connect(deployer).SetAssetValue("1500000000");
    // Alice Introduces the Asset to the Vault
    const balanceAliceBefore =
      parseInt((await USDc.balanceOf(alice.address)).toString()) / 10 ** 6;
    console.log(
      "Balance of Alice Before to Deposit in the Vault: ",
      balanceAliceBefore
    );
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(0);
    // Validate all Event Fire after Alice Deposit in the Vault
    expect(await Calculum.connect(alice).deposit(1500 * 10 ** 6, alice.address))
      .to.emit(Calculum, "PendingDeposit")
      .withArgs(alice.address, alice.address, 1500 * 10 ** 6, 1500 * 10 ** 18)
      .to.emit(USDc, "Transfer")
      .withArgs(alice.address, Calculum.address, 1500 * 10 ** 6);
    console.log(`Alice deposits ${1500} tokens os USDc`);
    // Validate Deposit in the Vault
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(1);
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).amountAssets.toString())
    ).to.equal(1500 * 10 ** 6);
    expect((await Calculum.DEPOSITS(alice.address)).amountShares).to.equal(
      ethers.utils.parseEther("1500")
    );
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).finalAmount.toString())
    ).to.equal(0);
    const balanceAliceVault =
      parseInt((await Calculum.balanceOf(alice.address)).toString()) / 10 ** 6;
    console.log("Verify of Balance of Alice in the Vault: ", balanceAliceVault);
    // Verify Alice don;t have any Vault token in your wallet
    expect(balanceAliceVault).to.equal(0);
    const balanceAliceAfter =
      parseInt((await USDc.balanceOf(alice.address)).toString()) / 10 ** 6;
    console.log(
      "Balance of Alice After to Deposit in the Vault: ",
      balanceAliceAfter
    );
    // Validate the Amount transferred from Alice to the Vault
    expect(balanceAliceBefore - balanceAliceAfter).to.equal(1500);
    // Move to Before the first Maintenance Window
    const move2: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move2.subtract(70, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Add ${maintTimeAfter} seconds: `,
      move2,
      " Full Date: ",
      moment(move2.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Fail Try to Finalize the Epoch Before to Start Maintenance Window
    await expect(
      Calculum.connect(transferBotRoleAddress).finalizeEpoch()
    ).to.revertedWith(
      `VaultOutMaintenance("${transferBotRoleAddress.address}", ${
        Math.floor((await ethers.provider.getBlock("latest")).timestamp) + 1
      })`
    );
    // Move to After Start the first Maintenance Window
    const move3: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move3.subtract(55, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after After Start the first Maintenance Window: `,
      move3,
      " Full Date: ",
      moment(move3.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    await snooze(1000);
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    console.log(
      "Maintenance Fee per Vault Token: ",
      parseInt((await Calculum.MgtFeePerVaultToken()).toString()) / 10 ** 6
    );
    const PNLPERTOKEN = await Calculum.getPnLPerVaultToken();
    console.log(
      `Profit and Loss per Vault Token:  ${PNLPERTOKEN ? "+" : "-"}`,
      parseInt((await Calculum.PnLPerVaultToken()).toString()) / 10 ** 6
    );
    console.log(
      "Performace Fee per Vault Token: ",
      parseInt((await Calculum.PerfFeePerVaultToken()).toString()) / 10 ** 6
    );
    console.log("Snooze for 1.5 min before First Finalize Epoch");
    await snooze(90000);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log("Finalize the First Epoch Successfully");
    // Verify changes in Alice Deposit
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(2);
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).amountAssets.toString())
    ).to.equal(0);
    expect((await Calculum.DEPOSITS(alice.address)).amountShares).to.equal(
      ethers.utils.parseEther("1500")
    );
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).finalAmount.toString())
    ).to.equal(1500 * 10 ** 6);
    // Getting netTransfer Object
    const netTranfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    console.log("netTransfer Pending: ", netTranfer.pending);
    console.log("netTransfer Direction: ", netTranfer.direction);
    console.log(
      "netTransfer Amount: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Check Balance of the Calculum Vault Before the Transfer
    const balanceCalculumVaultBefore =
      parseInt((await USDc.balanceOf(Calculum.address)).toString()) / 10 ** 6;
    // Execute the Dex Transfer such parameters establish in Finalize Contract
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, traderBotWallet.address, 1500 * 10 ** 6);
    // Check Balance of the Calculum Vault After the Transfer
    const balanceCalculumVaultAfter =
      parseInt((await USDc.balanceOf(Calculum.address)).toString()) / 10 ** 6;
    // Check Balance of the Calculum Vault After the Transfer is correct (Cero in this case because transfer all to Trader Bot Wallet)
    expect(balanceCalculumVaultBefore - 1500).to.equal(
      balanceCalculumVaultAfter
    );
    expect(balanceCalculumVaultAfter).to.equal(0);
    // Call FeeTransfer
    await expect(
      Calculum.connect(transferBotRoleAddress).feesTransfer()
    ).revertedWith("FirstEpochNoFeeTransfer");
    // Move to Time to change The First Epoch to Second Epoch
    const move4: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to Time to change The First Epoch to Second Epoch: `,
      move4,
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Update de Epoch
    await Calculum.connect(deployer).CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  //   ** Verification of Sequence of Second Epoch */
  //   ** 3. Verification of Sequence of Second Epoch */
  //   ** t1. Any Body  Execute any Deposit*/
  //   ** t2. Alice Executed your first Claim of Shares*/
  //   ** t3. Finalize the Epoch and Transfer Amount to the Trader Bot Wallet and Treasury Wallet (fee(Maintenance and Performance))*/
  it("3.- Verification of Sequence of Second Epoch (Epoch 1)", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    console.log("Deployer: ", deployer.address);
    console.log("Alice: ", alice.address);
    await expect(
      Calculum.connect(deployer).setEpochDuration(
        epochDuration,
        maintTimeBefore,
        maintTimeAfter
      )
    ).to.revertedWith(
      `VaultInMaintenance("${deployer.address}", ${timestamp + 1})`
    );
    // Revert if alice Try to Claim Her Shares in the Vault Maintenance Window
    await expect(
      Calculum.connect(alice).claimShares(alice.address)
    ).revertedWith(`VaultInMaintenance("${alice.address}", ${timestamp + 1})`);
    // Check the Current Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    // Move After To Finalize the Maintenance Window
    const move5: moment.Moment = moment(currentEpoch).add(
      maintTimeAfter * 2,
      "s"
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move5.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move5,
      " Full Date: ",
      moment(move5.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Revert if Bob Try to Claim the Alice Shares
    await expect(Calculum.connect(bob).claimShares(alice.address)).revertedWith(
      `CallerIsNotOwner("${bob.address}", "${alice.address}")`
    );
    // Revert if Bob Try to Claim Something
    await expect(Calculum.connect(bob).claimShares(bob.address)).revertedWith(
      `CalletIsNotClaimerToDeposit("${bob.address}")`
    );
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(2);
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).finalAmount.toString())
    ).to.equal(1500 * 10 ** 6);
    expect((await Calculum.DEPOSITS(alice.address)).amountShares).to.equal(
      ethers.utils.parseEther("1500")
    );
    // Alice try to Claim your Vault tokens  (Shares)
    await expect(Calculum.connect(alice).claimShares(alice.address))
      .to.emit(Calculum, "Transfer")
      .withArgs(ZERO_ADDRESS, alice.address, ethers.utils.parseEther("1500"));
    console.log("Alice Claimed her Shares Successfully");
    // Verify all Storege Correctly in the Smart Contract
    expect(await Calculum.balanceOf(alice.address)).to.equal(
      ethers.utils.parseEther("1500")
    );
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).finalAmount.toString())
    ).to.equal(1500 * 10 ** 6);
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).amountShares.toString())
    ).to.equal(0);
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(3);
    // Try to Finalize the Epoch before the Finalization Time
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(transferBotRoleAddress).finalizeEpoch()
    ).revertedWith(
      `VaultOutMaintenance("${transferBotRoleAddress.address}", ${time + 1})`
    );
    // Move After To Finalize the Maintenance Window
    const move6: moment.Moment = moment(nextEpoch).add(maintTimeAfter, "s");
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move6.subtract(45, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move6,
      " Full Date: ",
      moment(move6.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Setting the Value of the Assets 10% of Loss
    await Oracle.connect(deployer).SetAssetValue("1350000000");
    console.log("Snooze for 1.5 min before Second Finalize Epoch");
    await snooze(90000);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log(
      "Maintenance Fee per Vault Token: ",
      parseInt((await Calculum.MgtFeePerVaultToken()).toString()) / 10 ** 6
    );
    const PNLPERTOKEN = await Calculum.getPnLPerVaultToken();
    console.log(
      `Profit and Loss per Vault Token:  ${PNLPERTOKEN ? "+" : "-"}`,
      parseInt((await Calculum.PnLPerVaultToken()).toString()) / 10 ** 6
    );
    console.log(
      "Performace Fee per Vault Token: ",
      parseInt((await Calculum.PerfFeePerVaultToken()).toString()) / 10 ** 6
    );
    console.log("Finalize the Second Epoch Successfully");
    // Getting netTransfer Object
    const netTranfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    console.log("netTransfer Pending: ", netTranfer.pending);
    console.log("netTransfer Direction: ", netTranfer.direction);
    console.log(
      "netTransfer Amount: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Execute the Dex Transfer
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        traderBotWallet.address,
        Calculum.address,
        parseInt(
          (
            await Calculum.netTransfer(await Calculum.CURRENT_EPOCH())
          ).amount.toString()
        )
      );
    // Execute Fee Transfer
    await expect(Calculum.connect(transferBotRoleAddress).feesTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        Calculum.address,
        treasuryWallet.address,
        parseInt(netTranfer.amount.toString())
      );
    console.log(
      "Fees Transfer Successfully: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Move to Time to change The First Epoch to Second Epoch
    const move4: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to Time to change The First Epoch to Second Epoch: `,
      move4,
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Update de Epoch
    await Calculum.connect(deployer).CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  //   ** Verification of Sequence of Third Epoch */
  //   ** 4. Verification of Sequence of Third Epoch */
  //   ** t1. Bod Execute First Deposit*/
  //   ** t2. Finalize the Epoch and Transfer Amount to the Trader Bot Wallet and Treasury Wallet (fee(Maintenance and Performance))*/
  it("4.- Verification of Sequence of Third Epoch (Epoch 2)", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    // Revert attempt of Bod Execute First Deposit
    await expect(
      Calculum.connect(bob).deposit(500 * 10 ** 6, bob.address)
    ).revertedWith(`VaultInMaintenance("${bob.address}", ${timestamp + 1})`);
    // Move to after the Maintenance Time Post Maintenance
    const move1: moment.Moment = currentEpoch;
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move1.add(maintTimeAfter, "s").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to after Finalize the Maintenance Window: `,
      move1,
      " Full Date: ",
      moment(move1.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
    // Bod Execute First Deposit
    await expect(Calculum.connect(bob).deposit(500 * 10 ** 6, bob.address))
      .to.emit(Calculum, "PendingDeposit")
      .withArgs(
        bob.address,
        bob.address,
        500 * 10 ** 6,
        ethers.utils.parseEther("555.67965734569609435")
      )
      .to.emit(USDc, "Transfer")
      .withArgs(bob.address, Calculum.address, 500 * 10 ** 6);
    console.log(`Bob deposits ${500} tokens on USDc`);
    // Validate Deposit in the Vault
    expect((await Calculum.DEPOSITS(bob.address)).status).to.equal(1);
    expect(
      parseInt((await Calculum.DEPOSITS(bob.address)).amountAssets.toString())
    ).to.equal(500 * 10 ** 6);
    expect((await Calculum.DEPOSITS(bob.address)).amountShares).to.equal(
      ethers.utils.parseEther("555.67965734569609435")
    );
    expect(
      parseInt((await Calculum.DEPOSITS(bob.address)).finalAmount.toString())
    ).to.equal(0);
    // Move to After Start the first Maintenance Window
    const move3: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move3.subtract(55, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after After Start the first Maintenance Window: `,
      move3,
      " Full Date: ",
      moment(move3.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    await snooze(1000);
    // Set Vaule of Assets with a Loss of 5%
    await Oracle.connect(deployer).SetAssetValue("1282226400");
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    console.log("Snooze for 1.5 min before Third Finalize Epoch");
    await snooze(90000);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log(
      "Maintenance Fee per Vault Token: ",
      parseInt((await Calculum.MgtFeePerVaultToken()).toString()) / 10 ** 6
    );
    const PNLPERTOKEN = await Calculum.getPnLPerVaultToken();
    console.log(
      `Profit and Loss per Vault Token:  ${PNLPERTOKEN ? "+" : "-"}`,
      parseInt((await Calculum.PnLPerVaultToken()).toString()) / 10 ** 6
    );
    console.log(
      "Performace Fee per Vault Token: ",
      parseInt((await Calculum.PerfFeePerVaultToken()).toString()) / 10 ** 6
    );
    console.log("Finalize the Third Epoch Successfully");
    // Verify the Amount of Share will be minted by BOB
    console.log(
      "Amounts of shares will be minted by BOB: ",
      parseInt((await Calculum.DEPOSITS(bob.address)).amountShares.toString()) /
        10 ** 18
    );
    expect((await Calculum.DEPOSITS(bob.address)).amountShares).to.equal(
      ethers.utils.parseEther("585.038232248477438001")
    );
    console.log(
      "Amounts Estimated of shares of BOB: ",
      parseInt((await Calculum.DEPOSITS(bob.address)).amountShares.toString()) /
        10 ** 18
    );
    // Getting netTransfer Object
    const netTranfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    console.log("netTransfer Pending: ", netTranfer.pending);
    console.log("netTransfer Direction: ", netTranfer.direction);
    console.log(
      "netTransfer Amount: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Execute the Dex Transfer
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        Calculum.address,
        traderBotWallet.address,
        parseInt(
          (
            await Calculum.netTransfer(await Calculum.CURRENT_EPOCH())
          ).amount.toString()
        )
      );
    // Execute Fee Transfer
    await expect(Calculum.connect(transferBotRoleAddress).feesTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, treasuryWallet.address, parseInt("259500"));
    console.log("Fees Transfer Successfully: ", 259500);
    // Move to Time to change The First Epoch to Second Epoch
    const move4: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to Time to change The First Epoch to Second Epoch: `,
      move4,
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Update de Epoch
    await Calculum.connect(deployer).CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  //   ** Verification of Sequence of Fourth Epoch */
  //   ** 5. Verification of Sequence of Fourth Epoch */
  //   ** t1. Bod Claim your first Shares*/
  //   ** t2. Alice Executed your Second Deposit of Assets */
  //   ** t3. Carla Executed your First Deposit of Assets */
  //   ** t4. Finalize the Epoch and Transfer Amount to the Trader Bot Wallet and Treasury Wallet (fee(Maintenance and Performance))*/
  it("5. Verification of Sequence of Fourth Epoch (Epoch 3)", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(deployer).setEpochDuration(
        epochDuration,
        maintTimeBefore,
        maintTimeAfter
      )
    ).to.revertedWith(
      `VaultInMaintenance("${deployer.address}", ${timestamp + 1})`
    );
    // Revert if Bob Try to Claim Her Shares in the Vault Maintenance Window
    await expect(Calculum.connect(bob).claimShares(bob.address)).revertedWith(
      `VaultInMaintenance("${bob.address}", ${timestamp + 1})`
    );
    // Check the Current Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    // Move After To Finalize the Maintenance Window
    const move5: moment.Moment = moment(currentEpoch).add(
      maintTimeAfter * 2,
      "s"
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move5.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move5,
      " Full Date: ",
      moment(move5.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Revert if Alice Try to Claim the Bob Shares
    await expect(Calculum.connect(alice).claimShares(bob.address)).revertedWith(
      `CallerIsNotOwner("${alice.address}", "${bob.address}")`
    );
    // Revert if Carla Try to Claim Something
    await expect(
      Calculum.connect(carla).claimShares(carla.address)
    ).revertedWith(`CalletIsNotClaimerToDeposit("${carla.address}")`);
    expect((await Calculum.DEPOSITS(bob.address)).status).to.equal(2);
    expect(
      parseInt((await Calculum.DEPOSITS(bob.address)).finalAmount.toString())
    ).to.equal(500 * 10 ** 6);
    expect((await Calculum.DEPOSITS(bob.address)).amountShares).to.equal(
      ethers.utils.parseEther("585.038232248477438001")
    );
    // Alice try to Claim your Vault tokens  (Shares)
    await expect(Calculum.connect(bob).claimShares(bob.address))
      .to.emit(Calculum, "Transfer")
      .withArgs(
        ZERO_ADDRESS,
        bob.address,
        ethers.utils.parseEther("585.038232248477438001")
      );
    console.log("Bob Claimed her Shares Successfully");
    // Verify all Storege Correctly in the Smart Contract
    expect(await Calculum.balanceOf(bob.address)).to.equal(
      ethers.utils.parseEther("585.038232248477438001")
    );
    expect(
      parseInt((await Calculum.DEPOSITS(bob.address)).finalAmount.toString())
    ).to.equal(500 * 10 ** 6);
    expect(
      parseInt((await Calculum.DEPOSITS(bob.address)).amountShares.toString())
    ).to.equal(0);
    expect((await Calculum.DEPOSITS(bob.address)).status).to.equal(3);
    // Try to Finalize the Epoch before the Finalization Time
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(transferBotRoleAddress).finalizeEpoch()
    ).revertedWith(
      `VaultOutMaintenance("${transferBotRoleAddress.address}", ${time + 1})`
    );
    // Second Deposit of Alice
    // Alice Introduces the Asset to the Vault
    const balanceAliceBefore =
      parseInt((await USDc.balanceOf(alice.address)).toString()) / 10 ** 6;
    console.log(
      "Balance of Alice Before to Deposit in the Vault: ",
      balanceAliceBefore
    );
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(3);
    // Validate all Event Fire after Alice Deposit in the Vault
    expect(await Calculum.connect(alice).deposit(1000 * 10 ** 6, alice.address))
      .to.emit(Calculum, "PendingDeposit")
      .withArgs(
        alice.address,
        alice.address,
        1000 * 10 ** 6,
        ethers.utils.parseEther("1626.542572312016408562")
      )
      .to.emit(USDc, "Transfer")
      .withArgs(alice.address, Calculum.address, 1000 * 10 ** 6);
    console.log(`Alice deposits ${1000} tokens os USDc`);
    // Validate Deposit in the Vault
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(1);
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).amountAssets.toString())
    ).to.equal(1000 * 10 ** 6);
    expect((await Calculum.DEPOSITS(alice.address)).amountShares).to.equal(
      ethers.utils.parseEther("1626.539926675580105465")
    );
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).finalAmount.toString())
    ).to.equal(1500 * 10 ** 6);
    const balanceAliceVault =
      parseInt((await Calculum.balanceOf(alice.address)).toString()) / 10 ** 18;
    console.log("Verify of Balance of Alice in the Vault: ", balanceAliceVault);
    // Verify Alice have the first deposit of Vault token in your wallet
    expect(balanceAliceVault).to.equal(1500);
    const balanceAliceAfter =
      parseInt((await USDc.balanceOf(alice.address)).toString()) / 10 ** 6;
    console.log(
      "Balance of Alice After to Deposit in the Vault: ",
      balanceAliceAfter
    );
    // Validate the Amount transferred from Alice to the Vault
    expect(balanceAliceBefore - balanceAliceAfter).to.equal(1000);
    // First Deposit of Carla
    const balanceCarlaBefore =
      parseInt((await USDc.balanceOf(carla.address)).toString()) / 10 ** 6;
    console.log(
      "Balance of Carla Before to Deposit in the Vault: ",
      balanceCarlaBefore
    );
    expect((await Calculum.DEPOSITS(carla.address)).status).to.equal(0);
    // Validate all Event Fire after Alice Deposit in the Vault
    expect(await Calculum.connect(carla).deposit(300 * 10 ** 6, carla.address))
      .to.emit(Calculum, "PendingDeposit")
      .withArgs(
        carla.address,
        carla.address,
        300 * 10 ** 6,
        ethers.utils.parseEther("487.962771693604922569")
      )
      .to.emit(USDc, "Transfer")
      .withArgs(carla.address, Calculum.address, 300 * 10 ** 6);
    console.log(`Carla deposits ${300} tokens os USDc`);
    // Validate Deposit in the Vault
    expect((await Calculum.DEPOSITS(carla.address)).status).to.equal(1);
    expect(
      parseInt((await Calculum.DEPOSITS(carla.address)).amountAssets.toString())
    ).to.equal(300 * 10 ** 6);
    expect((await Calculum.DEPOSITS(carla.address)).amountShares).to.equal(
      ethers.utils.parseEther("487.961978002674031640")
    );
    expect(
      parseInt((await Calculum.DEPOSITS(carla.address)).finalAmount.toString())
    ).to.equal(0);
    const balanceCarlaVault =
      parseInt((await Calculum.balanceOf(carla.address)).toString()) / 10 ** 6;
    console.log("Verify of Balance of Carla in the Vault: ", balanceCarlaVault);
    // Verify Alice have the first deposit of Vault token in your wallet
    expect(balanceCarlaVault).to.equal(0);
    const balanceCarlaAfter =
      parseInt((await USDc.balanceOf(carla.address)).toString()) / 10 ** 6;
    console.log(
      "Balance of Carla After to Deposit in the Vault: ",
      balanceCarlaAfter
    );
    // Validate the Amount transferred from Carla to the Vault
    expect(balanceCarlaBefore - balanceCarlaAfter).to.equal(300);
    // Setting the Value of the Assets 5% of Profit
    await Oracle.connect(deployer).SetAssetValue("1871065245");
    // Move After To Finalize the Maintenance Window
    const move6: moment.Moment = moment(nextEpoch).add(maintTimeAfter, "s");
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move6.subtract(45, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move6,
      " Full Date: ",
      moment(move6.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    console.log("Snooze for 1.5 min before Fourth Finalize Epoch");
    await snooze(90000);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log(
      "Maintenance Fee per Vault Token: ",
      parseInt((await Calculum.MgtFeePerVaultToken()).toString()) / 10 ** 6
    );
    const PNLPERTOKEN = await Calculum.getPnLPerVaultToken();
    console.log(
      `Profit and Loss per Vault Token:  ${PNLPERTOKEN ? "+" : "-"}`,
      parseInt((await Calculum.PnLPerVaultToken()).toString()) / 10 ** 6
    );
    console.log(
      "Performace Fee per Vault Token: ",
      parseInt((await Calculum.PerfFeePerVaultToken()).toString()) / 10 ** 6
    );
    console.log("Finalize the Second Epoch Successfully");
    // Verify the Storage
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).amountAssets.toString())
    ).to.equal(0);
    expect((await Calculum.DEPOSITS(alice.address)).amountShares).to.equal(
      ethers.utils.parseEther("1122.582658567606979321")
    );
    expect(
      parseInt((await Calculum.DEPOSITS(carla.address)).amountAssets.toString())
    ).to.equal(0);
    expect((await Calculum.DEPOSITS(carla.address)).amountShares).to.equal(
      ethers.utils.parseEther("336.774797570282093797")
    );
    // Getting netTransfer Object
    const netTranfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    console.log("netTransfer Pending: ", netTranfer.pending);
    console.log("netTransfer Direction: ", netTranfer.direction);
    console.log(
      "netTransfer Amount: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Execute the Dex Transfer
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        Calculum.address,
        traderBotWallet.address,
        parseInt(netTranfer.amount.toString())
      );
    // Execute Fee Transfer
    await expect(Calculum.connect(transferBotRoleAddress).feesTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, treasuryWallet.address, 13706790);
    console.log("Fees Transfer Successfully: ", 13706790);
    // Move to Time to change The First Epoch to Second Epoch
    const move4: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to Time to change The First Epoch to Second Epoch: `,
      move4,
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Update de Epoch
    await Calculum.connect(deployer).CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  //   ** Verification of Sequence of Fifth Epoch */
  //   ** 6. Verification of Sequence of Fifth Epoch */
  //   ** t1. Alice Claim your second Shares*/
  //   ** t2. Carla Claim your first Shares */
  //   ** t3. Finalize the Epoch and Transfer Amount to the Trader Bot Wallet and Treasury Wallet (fee(Maintenance and Performance))*/
  it("6. Verification of Sequence of Fifth Epoch (Epoch 4)", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(deployer).setEpochDuration(
        epochDuration,
        maintTimeBefore,
        maintTimeAfter
      )
    ).to.revertedWith(
      `VaultInMaintenance("${deployer.address}", ${timestamp + 1})`
    );
    // Revert if Bob Try to Claim Her Shares in the Vault Maintenance Window
    await expect(Calculum.connect(bob).claimShares(bob.address)).revertedWith(
      `VaultInMaintenance("${bob.address}", ${timestamp + 1})`
    );
    // Check the Current Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    // Move After To Finalize the Maintenance Window
    const move5: moment.Moment = moment(currentEpoch).add(
      maintTimeAfter * 2,
      "s"
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move5.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move5,
      " Full Date: ",
      moment(move5.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Revert if Alice Try to Claim the Bob Shares
    await expect(Calculum.connect(alice).claimShares(bob.address)).revertedWith(
      `CallerIsNotOwner("${alice.address}", "${bob.address}")`
    );
    // Revert if Bob Try to Claim Something
    await expect(Calculum.connect(bob).claimShares(bob.address)).revertedWith(
      `CalletIsNotClaimerToDeposit("${bob.address}")`
    );
    // Verify the Share pending to Claim of Alice
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(2);
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).finalAmount.toString())
    ).to.equal(2500 * 10 ** 6);
    expect((await Calculum.DEPOSITS(alice.address)).amountShares).to.equal(
      ethers.utils.parseEther("1122.582658567606979321")
    );
    // Verify the Share pending to Claim of Carla
    expect((await Calculum.DEPOSITS(carla.address)).status).to.equal(2);
    expect(
      parseInt((await Calculum.DEPOSITS(carla.address)).finalAmount.toString())
    ).to.equal(300 * 10 ** 6);
    expect((await Calculum.DEPOSITS(carla.address)).amountShares).to.equal(
      ethers.utils.parseEther("336.774797570282093797")
    );
    // Alice try to Claim your Vault tokens  (Shares)
    await expect(Calculum.connect(alice).claimShares(alice.address))
      .to.emit(Calculum, "Transfer")
      .withArgs(
        ZERO_ADDRESS,
        alice.address,
        ethers.utils.parseEther("1122.582658567606979321")
      );
    console.log("Bob Claimed her Shares Successfully");
    // Verify all Storege Correctly in the Smart Contract
    // expect(await Calculum.balanceOf(bob.address)).to.equal(
    //   ethers.utils.parseEther("585.038916788744787303")
    // );
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).finalAmount.toString())
    ).to.equal(2500 * 10 ** 6);
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).amountShares.toString())
    ).to.equal(0);
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(3);
    // Carla try to Claim your Vault tokens  (Shares)
    await expect(Calculum.connect(carla).claimShares(carla.address))
      .to.emit(Calculum, "Transfer")
      .withArgs(
        ZERO_ADDRESS,
        carla.address,
        ethers.utils.parseEther("336.774797570282093797")
      );
    console.log("Bob Claimed her Shares Successfully");
    // Verify all Storege Correctly in the Smart Contract
    // expect(await Calculum.balanceOf(bob.address)).to.equal(
    //   ethers.utils.parseEther("585.038916788744787303")
    // );
    expect(
      parseInt((await Calculum.DEPOSITS(carla.address)).finalAmount.toString())
    ).to.equal(300 * 10 ** 6);
    expect(
      parseInt((await Calculum.DEPOSITS(carla.address)).amountShares.toString())
    ).to.equal(0);
    expect((await Calculum.DEPOSITS(carla.address)).status).to.equal(3);
    // Try to Finalize the Epoch before the Finalization Time
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(transferBotRoleAddress).finalizeEpoch()
    ).revertedWith(
      `VaultOutMaintenance("${transferBotRoleAddress.address}", ${time + 1})`
    );
    // Setting the Value of the Assets 5% of Profit
    await Oracle.connect(deployer).SetAssetValue("3315226114");
    // Move After To Finalize the Maintenance Window
    const move6: moment.Moment = moment(nextEpoch).add(maintTimeAfter, "s");
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move6.subtract(45, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move6,
      " Full Date: ",
      moment(move6.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    console.log("Snooze for 1.5 min before Fifth Finalize Epoch");
    await snooze(90000);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log(
      "Maintenance Fee per Vault Token: ",
      parseInt((await Calculum.MgtFeePerVaultToken()).toString()) / 10 ** 6
    );
    const PNLPERTOKEN = await Calculum.getPnLPerVaultToken();
    console.log(
      `Profit and Loss per Vault Token:  ${PNLPERTOKEN ? "+" : "-"}`,
      parseInt((await Calculum.PnLPerVaultToken()).toString()) / 10 ** 6
    );
    console.log(
      "Performace Fee per Vault Token: ",
      parseInt((await Calculum.PerfFeePerVaultToken()).toString()) / 10 ** 6
    );
    console.log("Finalize the Second Epoch Successfully");
    // Verify the Storage
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).amountAssets.toString())
    ).to.equal(0);
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).finalAmount.toString())
    ).to.equal(2500 * 10 ** 6);
    expect(
      parseInt((await Calculum.DEPOSITS(carla.address)).amountAssets.toString())
    ).to.equal(0);
    expect(
      parseInt((await Calculum.DEPOSITS(carla.address)).finalAmount.toString())
    ).to.equal(300 * 10 ** 6);
    // Getting netTransfer Object
    const netTranfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    console.log("netTransfer Pending: ", netTranfer.pending);
    console.log("netTransfer Direction: ", netTranfer.direction);
    console.log(
      "netTransfer Amount: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Execute the Dex Transfer
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        traderBotWallet.address,
        Calculum.address,
        parseInt(netTranfer.amount.toString())
      );
    // Execute Fee Transfer
    await expect(Calculum.connect(transferBotRoleAddress).feesTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, treasuryWallet.address, 24283488);
    console.log("Fees Transfer Successfully: ", 24283488 / 10 ** 6);
    // Move to Time to change The First Epoch to Second Epoch
    const move4: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to Time to change The First Epoch to Second Epoch: `,
      move4,
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Update de Epoch
    await Calculum.connect(deployer).CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  //   ** Verification of Sequence of Sixth Epoch */
  //   ** 7. Verification of Sequence of Sixth Epoch */
  //   ** t1. Alice Execute the first Withdraw */
  //   ** t2. Finalize the Epoch and Transfer Amount to the Trader Bot Wallet and Treasury Wallet (fee(Maintenance and Performance))*/
  it("7. Verification of Sequence of Sixth Epoch (Epoch 5)", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(deployer).setEpochDuration(
        epochDuration,
        maintTimeBefore,
        maintTimeAfter
      )
    ).to.revertedWith(
      `VaultInMaintenance("${deployer.address}", ${timestamp + 1})`
    );
    // Revert if Carla Try to Claim Her Shares in the Vault Maintenance Window
    await expect(
      Calculum.connect(carla).claimShares(carla.address)
    ).revertedWith(`VaultInMaintenance("${carla.address}", ${timestamp + 1})`);
    // Check the Current Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    // Move After To Finalize the Maintenance Window
    const move5: moment.Moment = moment(currentEpoch).add(
      maintTimeAfter * 2,
      "s"
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move5.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move5,
      " Full Date: ",
      moment(move5.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Revert if Alice Try to Claim the Bob Shares
    await expect(Calculum.connect(carla).claimShares(bob.address)).revertedWith(
      `CallerIsNotOwner("${carla.address}", "${bob.address}")`
    );
    // Revert if Bob Try to Claim Something
    await expect(Calculum.connect(bob).claimShares(bob.address)).revertedWith(
      `CalletIsNotClaimerToDeposit("${bob.address}")`
    );

    // Alice try to Execute the First Withdraw with your Vault tokens  (Shares)
    await expect(
      Calculum.connect(alice).withdraw(
        parseInt("1269") * 10 ** 6,
        alice.address,
        alice.address
      )
    )
      .to.emit(Calculum, "PendingWithdraw")
      .withArgs(
        alice.address,
        alice.address,
        parseInt("1269") * 10 ** 6,
        ethers.utils.parseEther("1358.471660504122517230")
      );
    console.log("Alice Executed Withdraw her Assets Successfully");
    // Verify the Storage
    expect((await Calculum.WITHDRAWALS(alice.address)).status).to.equal(1);
    expect(
      parseInt(
        (await Calculum.WITHDRAWALS(alice.address)).finalAmount.toString()
      )
    ).to.equal(0);
    expect((await Calculum.WITHDRAWALS(alice.address)).amountAssets).to.equal(
      parseInt("1269") * 10 ** 6
    );
    expect((await Calculum.WITHDRAWALS(alice.address)).amountShares).to.equal(
      ethers.utils.parseEther("1358.471660504122517230")
    );
    // Try to Finalize the Epoch before the Finalization Time
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(transferBotRoleAddress).finalizeEpoch()
    ).revertedWith(
      `VaultOutMaintenance("${transferBotRoleAddress.address}", ${time + 1})`
    );
    // Setting the Value of the Assets 5% of Profit
    await Oracle.connect(deployer).SetAssetValue("3455486910");
    // Move After To Finalize the Maintenance Window
    const move6: moment.Moment = moment(nextEpoch).add(maintTimeAfter, "s");
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move6.subtract(45, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move6,
      " Full Date: ",
      moment(move6.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    console.log("Snooze for 1.5 min before Sixth Finalize Epoch");
    await snooze(90000);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log(
      "Maintenance Fee per Vault Token: ",
      parseInt((await Calculum.MgtFeePerVaultToken()).toString()) / 10 ** 6
    );
    const PNLPERTOKEN = await Calculum.getPnLPerVaultToken();
    console.log(
      `Profit and Loss per Vault Token:  ${PNLPERTOKEN ? "+" : "-"}`,
      parseInt((await Calculum.PnLPerVaultToken()).toString()) / 10 ** 6
    );
    console.log(
      "Performace Fee per Vault Token: ",
      parseInt((await Calculum.PerfFeePerVaultToken()).toString()) / 10 ** 6
    );
    console.log("Finalize the Sixth Epoch Successfully");
    // Verify the Storage of Withdraw
    expect((await Calculum.WITHDRAWALS(alice.address)).status).to.equal(2);
    expect(
      parseInt(
        (await Calculum.WITHDRAWALS(alice.address)).finalAmount.toString()
      )
    ).to.equal(parseInt("1269") * 10 ** 6);
    expect((await Calculum.WITHDRAWALS(alice.address)).amountAssets).to.equal(
      0
    );
    expect((await Calculum.WITHDRAWALS(alice.address)).amountShares).to.equal(
      ethers.utils.parseEther("1311.256553699520755879")
    );
    // Getting netTransfer Object
    const netTranfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    console.log("netTransfer Pending: ", netTranfer.pending);
    console.log("netTransfer Direction: ", netTranfer.direction);
    console.log(
      "netTransfer Amount: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Execute the Dex Transfer
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        traderBotWallet.address,
        Calculum.address,
        parseInt(netTranfer.amount.toString())
      );
    // Execute Fee Transfer
    await expect(Calculum.connect(transferBotRoleAddress).feesTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, treasuryWallet.address, 25311248);
    console.log("Fees Transfer Successfully: ", 25.311248);
    // Move to Time to change The First Epoch to Second Epoch
    const move4: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to Time to change The First Epoch to Second Epoch: `,
      move4,
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Update de Epoch
    await Calculum.connect(deployer).CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  //   ** Verification of Sequence of Seventh Epoch */
  //   ** 8. Verification of Sequence of Seventh Epoch */
  //   ** t1. Alice Execute the Claim Assets */
  //   ** t2. Carla Execute the first Withdraw */
  //   ** t3. Finalize the Epoch and Transfer Amount to the Trader Bot Wallet and Treasury Wallet (fee(Maintenance and Performance))*/
  it("8. Verification of Sequence of Seventh Epoch (Epoch 6)", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(deployer).setEpochDuration(
        epochDuration,
        maintTimeBefore,
        maintTimeAfter
      )
    ).to.revertedWith(
      `VaultInMaintenance("${deployer.address}", ${timestamp + 1})`
    );
    // Revert if Carla Try to Claim Her Shares in the Vault Maintenance Window
    await expect(
      Calculum.connect(carla).claimShares(carla.address)
    ).revertedWith(`VaultInMaintenance("${carla.address}", ${timestamp + 1})`);
    // Check the Current Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    // Move After To Finalize the Maintenance Window
    const move5: moment.Moment = moment(currentEpoch).add(
      maintTimeAfter * 2,
      "s"
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move5.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move5,
      " Full Date: ",
      moment(move5.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Revert if Alice Try to Claim the Bob Shares
    await expect(Calculum.connect(alice).claimShares(bob.address)).revertedWith(
      `CallerIsNotOwner("${alice.address}", "${bob.address}")`
    );
    // Revert if Bob Try to Claim Something
    await expect(
      Calculum.connect(bob).claimAssets(bob.address, bob.address)
    ).revertedWith(`CalletIsNotClaimerToRedeem("${bob.address}")`);
    // Verify the Storage
    expect((await Calculum.WITHDRAWALS(alice.address)).status).to.equal(2);
    expect(
      parseInt(
        (await Calculum.WITHDRAWALS(alice.address)).finalAmount.toString()
      )
    ).to.equal(1269000000);
    expect((await Calculum.WITHDRAWALS(alice.address)).amountAssets).to.equal(
      0
    );
    expect((await Calculum.WITHDRAWALS(alice.address)).amountShares).to.equal(
      ethers.utils.parseEther("1311.256553699520755879")
    );
    // Alice try to Execute the First Withdraw with your Vault tokens  (Shares)
    await expect(
      Calculum.connect(alice).claimAssets(alice.address, alice.address)
    )
      .to.emit(Calculum, "Withdraw")
      .withArgs(
        alice.address,
        alice.address,
        alice.address,
        parseInt("1269") * 10 ** 6,
        ethers.utils.parseEther("1311.257908621133261623")
      )
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, alice.address, parseInt("1269") * 10 ** 6);
    console.log("Alice Executed claim of her Assets Successfully");
    // Verify the Storage
    expect((await Calculum.WITHDRAWALS(alice.address)).status).to.equal(3);
    expect(
      parseInt(
        (await Calculum.WITHDRAWALS(alice.address)).finalAmount.toString()
      )
    ).to.equal(parseInt("1269") * 10 ** 6);
    expect((await Calculum.WITHDRAWALS(alice.address)).amountAssets).to.equal(
      0
    );
    expect((await Calculum.WITHDRAWALS(alice.address)).amountShares).to.equal(
      0
    );
    // Carla to Execute the First Withdraw with your Vault tokens  (Shares)
    await expect(
      Calculum.connect(carla).redeem(
        ethers.utils.parseEther("114.227563494569054603"),
        carla.address,
        carla.address
      )
    )
      .to.emit(Calculum, "PendingWithdraw")
      .withArgs(
        carla.address,
        carla.address,
        parseInt("166800001"),
        ethers.utils.parseEther("114.227563494569054603")
      );
    console.log("Carla Executed Withdraw her Assets Successfully");
    // Try to Finalize the Epoch before the Finalization Time
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(transferBotRoleAddress).finalizeEpoch()
    ).revertedWith(
      `VaultOutMaintenance("${transferBotRoleAddress.address}", ${time + 1})`
    );
    // Setting the Value of the Assets 5% of Profit
    await Oracle.connect(deployer).SetAssetValue("2222042863");
    // Move After To Finalize the Maintenance Window
    const move6: moment.Moment = moment(nextEpoch).add(maintTimeAfter, "s");
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move6.subtract(45, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move6,
      " Full Date: ",
      moment(move6.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    console.log("Snooze for 1.5 min before Seventh Finalize Epoch");
    await snooze(90000);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log(
      "Maintenance Fee per Vault Token: ",
      parseInt((await Calculum.MgtFeePerVaultToken()).toString()) / 10 ** 6
    );
    const PNLPERTOKEN = await Calculum.getPnLPerVaultToken();
    console.log(
      `Profit and Loss per Vault Token:  ${PNLPERTOKEN ? "+" : "-"}`,
      parseInt((await Calculum.PnLPerVaultToken()).toString()) / 10 ** 6
    );
    console.log(
      "Performace Fee per Vault Token: ",
      parseInt((await Calculum.PerfFeePerVaultToken()).toString()) / 10 ** 6
    );
    console.log("Finalize the Sixth Epoch Successfully");
    // Getting netTransfer Object
    const netTranfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    console.log("netTransfer Pending: ", netTranfer.pending);
    console.log("netTransfer Direction: ", netTranfer.direction);
    console.log(
      "netTransfer Amount: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Execute the Dex Transfer
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        traderBotWallet.address,
        Calculum.address,
        parseInt(netTranfer.amount.toString())
      );
    // Execute Fee Transfer
    await expect(Calculum.connect(transferBotRoleAddress).feesTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, treasuryWallet.address, 9546075);
    console.log("Fees Transfer Successfully: ", 9546075 / 10 ** 6);
    // Move to Time to change The First Epoch to Second Epoch
    const move4: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to Time to change The First Epoch to Second Epoch: `,
      move4,
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Update de Epoch
    await Calculum.connect(deployer).CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  //   ** Verification of Sequence of Eighth Epoch */
  //   ** 9. Verification of Sequence of Eighth Epoch */
  //   ** t1. Carla Execute the first Claim Assets */
  //   ** t2. Bod Execute the second deposit */
  //   ** t3. Finalize the Epoch and Transfer Amount to the Trader Bot Wallet and Treasury Wallet (fee(Maintenance and Performance))*/
  it("9. Verification of Sequence of Eighth Epoch (Epoch 7)", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(deployer).setEpochDuration(
        epochDuration,
        maintTimeBefore,
        maintTimeAfter
      )
    ).to.revertedWith(
      `VaultInMaintenance("${deployer.address}", ${timestamp + 1})`
    );
    // Revert if Carla Try to Claim Her Shares in the Vault Maintenance Window
    await expect(
      Calculum.connect(carla).claimShares(carla.address)
    ).revertedWith(`VaultInMaintenance("${carla.address}", ${timestamp + 1})`);
    // Check the Current Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    // Move After To Finalize the Maintenance Window
    const move5: moment.Moment = moment(currentEpoch).add(
      maintTimeAfter * 2,
      "s"
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move5.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move5,
      " Full Date: ",
      moment(move5.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Revert if Alice Try to Claim the carla Shares
    await expect(
      Calculum.connect(alice).claimShares(carla.address)
    ).revertedWith(`CallerIsNotOwner("${alice.address}", "${carla.address}")`);
    // Revert if Bob Try to Claim Something
    await expect(
      Calculum.connect(bob).claimAssets(bob.address, bob.address)
    ).revertedWith(`CalletIsNotClaimerToRedeem("${bob.address}")`);
    // Verify the Storage
    expect((await Calculum.WITHDRAWALS(carla.address)).status).to.equal(2);
    expect(
      parseInt(
        (await Calculum.WITHDRAWALS(carla.address)).finalAmount.toString()
      )
    ).to.equal(166800001);
    expect((await Calculum.WITHDRAWALS(carla.address)).amountAssets).to.equal(
      0
    );
    expect((await Calculum.WITHDRAWALS(carla.address)).amountShares).to.equal(
      ethers.utils.parseEther("168.356116585600707338")
    );
    // Carla try to Execute the First Withdraw with your Vault tokens  (Shares)
    await expect(
      Calculum.connect(carla).claimAssets(carla.address, carla.address)
    )
      .to.emit(Calculum, "Withdraw")
      .withArgs(
        carla.address,
        carla.address,
        carla.address,
        parseInt("166800001"),
        ethers.utils.parseEther("168.4")
      )
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, carla.address, parseInt("166800001"));
    console.log("Carla Executed claim of her Assets Successfully");
    // Verify the Storage
    expect((await Calculum.WITHDRAWALS(carla.address)).status).to.equal(3);
    expect(
      parseInt(
        (await Calculum.WITHDRAWALS(carla.address)).finalAmount.toString()
      )
    ).to.equal(parseInt("166800001"));
    expect((await Calculum.WITHDRAWALS(carla.address)).amountAssets).to.equal(
      0
    );
    expect((await Calculum.WITHDRAWALS(carla.address)).amountShares).to.equal(
      0
    );
    // Bob Execute the Second Deposit
    await expect(Calculum.connect(bob).deposit(500 * 10 ** 6, bob.address))
      .to.emit(Calculum, "PendingDeposit")
      .withArgs(
        bob.address,
        bob.address,
        500 * 10 ** 6,
        ethers.utils.parseEther("470.295213711551014804")
      )
      .to.emit(USDc, "Transfer")
      .withArgs(bob.address, Calculum.address, 500 * 10 ** 6);
    console.log(`Bob deposits ${500} tokens on USDc`);
    // Validate Deposit in the Vault
    expect((await Calculum.DEPOSITS(bob.address)).status).to.equal(1);
    expect(
      parseInt((await Calculum.DEPOSITS(bob.address)).amountAssets.toString())
    ).to.equal(500 * 10 ** 6);
    expect((await Calculum.DEPOSITS(bob.address)).amountShares).to.equal(
      ethers.utils.parseEther("470.295213711551014804")
    );
    console.log(
      "Amounts Estimated of shares of BOB: ",
      parseInt((await Calculum.DEPOSITS(bob.address)).amountShares.toString()) /
        10 ** 18
    );
    expect(
      parseInt((await Calculum.DEPOSITS(bob.address)).finalAmount.toString())
    ).to.equal(500000000);
    // Try to Finalize the Epoch before the Finalization Time
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(transferBotRoleAddress).finalizeEpoch()
    ).revertedWith(
      `VaultOutMaintenance("${transferBotRoleAddress.address}", ${time + 1})`
    );
    // Setting the Value of the Assets 5% of Profit
    await Oracle.connect(deployer).SetAssetValue("2107028453");
    // Move After To Finalize the Maintenance Window
    const move6: moment.Moment = moment(nextEpoch).add(maintTimeAfter, "s");
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move6.subtract(45, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move6,
      " Full Date: ",
      moment(move6.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    console.log("Snooze for 1.5 min before Eighth Finalize Epoch");
    await snooze(90000);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log(
      "Maintenance Fee per Vault Token: ",
      parseInt((await Calculum.MgtFeePerVaultToken()).toString()) / 10 ** 6
    );
    const PNLPERTOKEN = await Calculum.getPnLPerVaultToken();
    console.log(
      `Profit and Loss per Vault Token:  ${PNLPERTOKEN ? "+" : "-"}`,
      parseInt((await Calculum.PnLPerVaultToken()).toString()) / 10 ** 6
    );
    console.log(
      "Performace Fee per Vault Token: ",
      parseInt((await Calculum.PerfFeePerVaultToken()).toString()) / 10 ** 6
    );
    console.log("Finalize the Sixth Epoch Successfully");
    // Getting netTransfer Object
    const netTranfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    console.log("netTransfer Pending: ", netTranfer.pending);
    console.log("netTransfer Direction: ", netTranfer.direction);
    console.log(
      "netTransfer Amount: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Execute the Dex Transfer
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        Calculum.address,
        traderBotWallet.address,
        parseInt(netTranfer.amount.toString())
      );
    // Execute Fee Transfer
    await expect(Calculum.connect(transferBotRoleAddress).feesTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, treasuryWallet.address, 9589344);
    console.log("Fees Transfer Successfully: ", 9589344 / 10 ** 6);
    // Move to Time to change The First Epoch to Second Epoch
    const move4: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to Time to change The First Epoch to Second Epoch: `,
      move4,
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Update de Epoch
    await Calculum.connect(deployer).CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  //   ** Verification of Sequence of Ninth Epoch */
  //   ** 10. Verification of Sequence of Ninth Epoch */
  //   ** t1. Bod Execute the second Claim Shares */
  //   ** t2. Finalize the Epoch and Transfer Amount to the Trader Bot Wallet and Treasury Wallet (fee(Maintenance and Performance))*/
  it("10. Verification of Sequence of Ninth Epoch (Epoch 8)", async () => {
    const timestamp: number = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(deployer).setEpochDuration(
        epochDuration,
        maintTimeBefore,
        maintTimeAfter
      )
    ).to.revertedWith(
      `VaultInMaintenance("${deployer.address}", ${timestamp + 1})`
    );
    // Revert if Carla Try to Claim Her Shares in the Vault Maintenance Window
    await expect(
      Calculum.connect(carla).claimShares(carla.address)
    ).revertedWith(`VaultInMaintenance("${carla.address}", ${timestamp + 1})`);
    // Check the Current Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    // Move After To Finalize the Maintenance Window
    const move5: moment.Moment = moment(currentEpoch).add(
      maintTimeAfter * 2,
      "s"
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move5.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move5,
      " Full Date: ",
      moment(move5.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Revert if Alice Try to Claim the carla Shares
    await expect(
      Calculum.connect(alice).claimShares(carla.address)
    ).revertedWith(`CallerIsNotOwner("${alice.address}", "${carla.address}")`);
    // Revert if Bob Try to Claim Something
    await expect(
      Calculum.connect(carla).claimAssets(carla.address, carla.address)
    ).revertedWith(`CalletIsNotClaimerToRedeem("${carla.address}")`);
    // Verify the Storage
    expect((await Calculum.DEPOSITS(bob.address)).status).to.equal(2);
    expect(
      parseInt((await Calculum.DEPOSITS(bob.address)).finalAmount.toString())
    ).to.equal(1000000000);
    expect((await Calculum.DEPOSITS(bob.address)).amountAssets).to.equal(0);
    expect((await Calculum.DEPOSITS(bob.address)).amountShares).to.equal(
      ethers.utils.parseEther("492.216094678750243647")
    );
    // Carla try to Execute the First Withdraw with your Vault tokens  (Shares)
    await expect(Calculum.connect(bob).claimShares(bob.address))
      .to.emit(Calculum, "Transfer")
      .withArgs(
        ZERO_ADDRESS,
        bob.address,
        ethers.utils.parseEther("492.216094678750243647")
      )
      .to.emit(Calculum, "Deposit")
      .withArgs(
        bob.address,
        bob.address,
        parseInt("1000") * 10 ** 6,
        ethers.utils.parseEther("492.216094678750243647")
      );
    console.log("Bob Executed claim of her Second Shares Successfully");
    // Verify the Storage
    expect((await Calculum.DEPOSITS(bob.address)).status).to.equal(3);
    expect(
      parseInt((await Calculum.DEPOSITS(bob.address)).finalAmount.toString())
    ).to.equal(parseInt("1000") * 10 ** 6);
    expect((await Calculum.DEPOSITS(bob.address)).amountAssets).to.equal(0);
    expect((await Calculum.DEPOSITS(bob.address)).amountShares).to.equal(0);
    // Try to Finalize the Epoch before the Finalization Time
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    await expect(
      Calculum.connect(transferBotRoleAddress).finalizeEpoch()
    ).revertedWith(
      `VaultOutMaintenance("${transferBotRoleAddress.address}", ${time + 1})`
    );
    // Setting the Value of the Assets 5% of Profit
    await Oracle.connect(deployer).SetAssetValue("2660984944");
    // Move After To Finalize the Maintenance Window
    const move6: moment.Moment = moment(nextEpoch).add(maintTimeAfter, "s");
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move6.subtract(45, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after To Finalize the Maintenance Window: `,
      move6,
      " Full Date: ",
      moment(move6.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    console.log("Snooze for 1.5 min before Ninth Finalize Epoch");
    await snooze(90000);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log(
      "Maintenance Fee per Vault Token: ",
      parseInt((await Calculum.MgtFeePerVaultToken()).toString()) / 10 ** 6
    );
    const PNLPERTOKEN = await Calculum.getPnLPerVaultToken();
    console.log(
      `Profit and Loss per Vault Token:  ${PNLPERTOKEN ? "+" : "-"}`,
      parseInt((await Calculum.PnLPerVaultToken()).toString()) / 10 ** 6
    );
    console.log(
      "Performace Fee per Vault Token: ",
      parseInt((await Calculum.PerfFeePerVaultToken()).toString()) / 10 ** 6
    );
    console.log("Finalize the Sixth Epoch Successfully");
    // Getting netTransfer Object
    const netTranfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    console.log("netTransfer Pending: ", netTranfer.pending);
    console.log("netTransfer Direction: ", netTranfer.direction);
    console.log(
      "netTransfer Amount: ",
      parseInt(netTranfer.amount.toString()) / 10 ** 6
    );
    // Execute the Dex Transfer
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        traderBotWallet.address,
        Calculum.address,
        parseInt(netTranfer.amount.toString())
      );
    // Execute Fee Transfer
    await expect(Calculum.connect(transferBotRoleAddress).feesTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, treasuryWallet.address, 10027188);
    console.log("Fees Transfer Successfully: ", 10027188 / 10 ** 6);
    // Move to Time to change The First Epoch to Second Epoch
    const move4: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Move to Time to change The First Epoch to Second Epoch: `,
      move4,
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Update de Epoch
    await Calculum.connect(deployer).CurrentEpoch();
    // Getting Current Epoch and Next Epoch
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });

  after(async () => {
    await network.provider.send("evm_mine", []);
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    console.log(
      "Verify TimeStamp: ",
      time,
      " Full Date: ",
      moment(time * 1000)
        .utc()
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    console.log(
      `Number of Current Epoch: ${parseInt(
        (await Calculum.CURRENT_EPOCH()).toString()
      )}`
    );
    console.log(
      "Treasury Balance: ",
      parseInt((await USDc.balanceOf(treasuryWallet.address)).toString()) /
        10 ** 6
    );
    console.log(
      "Total Supply fo Vault: ",
      parseInt((await Calculum.totalSupply()).toString()) / 10 ** 18
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc());
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc());
  });
});
