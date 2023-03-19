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
let transferBotWallet: SignerWithAddress;
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
const epochDuration = 60 * 60 * 24 * 7;
const maintTimeBefore = 60 * 60;
const maintTimeAfter = 30 * 60;
const MIN_DEPOSIT = 30000 * 10 ** 6;
const MAX_DEPOSIT = 150000 * 10 ** 6;
const MAX_TOTAL_DEPOSIT = 1000000 * 10 ** 6;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const UNISWAP_ROUTER2 = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

const snooze = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Verification of Basic Value and Features", function () {
  const EPOCH_TIME: moment.Moment = moment();
  const EPOCH_START = EPOCH_TIME.utc(false).unix();
  let currentEpoch: moment.Moment;
  let nextEpoch: moment.Moment;
  before(async () => {
    [
      deployer,
      treasuryWallet,
      transferBotWallet,
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
    await USDc.mint(deployer.address, 100000 * 10 ** 6);
    await USDc.mint(alice.address, 250000 * 10 ** 6);
    await USDc.mint(bob.address, 100000 * 10 ** 6);
    await USDc.mint(carla.address, 30000 * 10 ** 6);
    // Deploy Mockup Oracle
    OracleFactory = (await ethers.getContractFactory(
      "MockUpOracle",
      deployer
    )) as MockUpOracle__factory;
    // Deploy Oracle
    Oracle = (await OracleFactory.deploy(
      transferBotWallet.address,
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
      transferBotWallet.address,
      treasuryWallet.address,
      transferBotRoleAddress.address,
      UNISWAP_ROUTER2,
      [EPOCH_START, MIN_DEPOSIT, MAX_DEPOSIT, MAX_TOTAL_DEPOSIT],
    ])) as CalculumVault;
    // eslint-disable-next-line no-unused-expressions
    expect(Calculum.address).to.properAddress;
    console.log(`Calculum Address: ${Calculum.address}`);
    // Allowance the Contract in Stable Coin
    await USDc.connect(deployer).approve(Calculum.address, 100000 * 10 ** 6);
    await USDc.connect(alice).approve(Calculum.address, 250000 * 10 ** 6);
    await USDc.connect(bob).approve(Calculum.address, 100000 * 10 ** 6);
    await USDc.connect(carla).approve(Calculum.address, 30000 * 10 ** 6);
    await USDc.connect(transferBotRoleAddress).approve(
      Calculum.address,
      2000000 * 10 ** 6
    );
    await USDc.connect(transferBotWallet).approve(
      Calculum.address,
      2000000 * 10 ** 6
    );
    // Mint 200 USDc to the Contract Vault
    await USDc.connect(deployer).transfer(Calculum.address, 200 * 10 ** 6);
    // Set Balance in the Deployer Address a value of 0.5 ETH with hardhat rpc method
    await network.provider.send("hardhat_setBalance", [
      deployer.address,
      "0x11f9f2bea4c68000",
    ]);
    // Transfer 0.5 ETh from deployer to Contract Vault Address
    await deployer.sendTransaction({
      to: Calculum.address,
      value: ethers.utils.parseEther("0.5"),
    });
    console.log(`EPOCH_START : ${EPOCH_START}`);
    console.log(
      "Epoch Start Full Date: " +
        moment(EPOCH_TIME.utc(false).unix() * 1000)
          .utc(false)
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
        .utc(false)
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc(false));
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
    expect(await Calculum.transferBotWallet()).to.equal(
      transferBotWallet.address
    );
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
    expect(await Calculum.MIN_DEPOSIT()).to.equal(MIN_DEPOSIT);
    // Verify Max Deposit
    expect(await Calculum.MAX_DEPOSIT()).to.equal(MAX_DEPOSIT);
    // Verify Max Total Deposit into Vault
    expect(await Calculum.MAX_TOTAL_DEPOSIT()).to.equal(MAX_TOTAL_DEPOSIT);
    // Verify router address Uniswap V2
    expect(await Calculum.router()).to.equal(UNISWAP_ROUTER2);
    // Verify Balance of ERC20 USDc of the Contract Vault
    expect(await USDc.balanceOf(Calculum.address)).to.equal(200 * 10 ** 6);
    // Verify Balance of 0.5 ETH in ethereum of Contract Vault
    expect(await ethers.provider.getBalance(Calculum.address)).to.equal(
      ethers.utils.parseEther("0.5")
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
    )
      .to.revertedWithCustomError(Calculum, "VaultInMaintenance")
      .withArgs(deployer.address, `${timestamp + 1}`);
    // Move to after the Maintenance Time Post Maintenance
    const move1: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move1.add(maintTimeAfter + 60, "s").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Add ${maintTimeAfter} seconds for Maintenance Window: `,
      moment(move1.unix() * 1000).utc(false),
      " Full Date: ",
      moment(move1.unix() * 1000)
        .utc(false)
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
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc(false));
    let nextEpoch: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc(false));
    // Setting the Value of Epoch Duration and Maintenance Time Before and After
    await Calculum.connect(deployer).setEpochDuration(
      epochDuration,
      maintTimeBefore,
      maintTimeAfter
    );
    console.log("Epoch time Before to Move 2nd Epoch: ", EPOCH_TIME.utc(false));
    // Move to after Finalize the Next Epoch (2nd Epoch)
    // EPoch Time changes when adding the Epoch Duration
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(EPOCH_TIME.utc(false).add(epochDuration, "s").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    const move2: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    console.log(
      `Verify TimeStamp after Add ${epochDuration} seconds for Next Epoch: `,
      moment(move2.unix() * 1000).utc(false),
      " Full Date: ",
      moment(move2.unix() * 1000)
        .utc(false)
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
    console.log(
      "TimeStamp Current Epoch (2nd): ",
      currentEpoch,
      "Number Epoch:",
      parseInt((await Calculum.CURRENT_EPOCH()).toString())
    );
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log(
      "TimeStamp Next Epoch (3rd): ",
      nextEpoch,
      "Number Epoch:",
      parseInt((await Calculum.CURRENT_EPOCH()).toString()) + 1
    );
    console.log("Epoch time Before to Move 3rd Epoch: ", EPOCH_TIME.utc(false));
    // Move to after Finalize the Next Epoch (3rd Epoch)
    // EPoch Time changes when adding the Epoch Duration
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(
        EPOCH_TIME.utc(false)
          .add(epochDuration + 30, "s")
          .format("X")
      ),
    ]);
    await network.provider.send("evm_mine", []);
    const move3: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    console.log(
      `Verify TimeStamp after Add ${epochDuration} seconds: `,
      moment(move3.unix() * 1000).utc(false),
      " Full Date: ",
      moment(move3.unix() * 1000)
        .utc(false)
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    await Calculum.CurrentEpoch();
    console.log(
      "Verification of Current Epoch (3rd): ",
      parseInt((await Calculum.CURRENT_EPOCH()).toString())
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc(false));
    await Calculum.CurrentEpoch();
    console.log(
      "Verification of Current Epoch (3rd): (Verification not changes): ",
      parseInt((await Calculum.CURRENT_EPOCH()).toString())
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc(false));
    await Calculum.CurrentEpoch();
    console.log(
      "Verification of Current Epoch (3rd): (Verification not changes): ",
      parseInt((await Calculum.CURRENT_EPOCH()).toString())
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc(false));
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc(false));
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
        .utc(false)
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
  });
});

describe("Verification of Basic Value and Features", function () {
  const EPOCH_TIME: moment.Moment = moment();
  const EPOCH_START = EPOCH_TIME.utc(false).unix();
  let currentEpoch: moment.Moment;
  let nextEpoch: moment.Moment;
  before(async () => {
    [
      deployer,
      treasuryWallet,
      transferBotWallet,
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
    await USDc.mint(deployer.address, 100000 * 10 ** 6);
    await USDc.mint(alice.address, 250000 * 10 ** 6);
    await USDc.mint(bob.address, 100000 * 10 ** 6);
    await USDc.mint(carla.address, 30000 * 10 ** 6);
    // Deploy Mockup Oracle
    OracleFactory = (await ethers.getContractFactory(
      "MockUpOracle",
      deployer
    )) as MockUpOracle__factory;
    // Deploy Oracle
    Oracle = (await OracleFactory.deploy(
      transferBotWallet.address,
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
      transferBotWallet.address,
      treasuryWallet.address,
      transferBotRoleAddress.address,
      UNISWAP_ROUTER2,
      [EPOCH_START, MIN_DEPOSIT, MAX_DEPOSIT, MAX_TOTAL_DEPOSIT],
    ])) as CalculumVault;
    // eslint-disable-next-line no-unused-expressions
    expect(Calculum.address).to.properAddress;
    console.log(`Calculum Address: ${Calculum.address}`);
    // Allowance the Contract in Stable Coin
    await USDc.connect(deployer).approve(Calculum.address, 100000 * 10 ** 6);
    await USDc.connect(alice).approve(Calculum.address, 250000 * 10 ** 6);
    await USDc.connect(bob).approve(Calculum.address, 100000 * 10 ** 6);
    await USDc.connect(carla).approve(Calculum.address, 30000 * 10 ** 6);
    await USDc.connect(transferBotRoleAddress).approve(
      Calculum.address,
      2000000 * 10 ** 6
    );
    await USDc.connect(transferBotWallet).approve(
      Calculum.address,
      2000000 * 10 ** 6
    );
    // Mint 200 USDc to the Contract Vault
    await USDc.connect(deployer).transfer(Calculum.address, 200 * 10 ** 6);
    // Set Balance in the Deployer Address a value of 0.5 ETH with hardhat rpc method
    await network.provider.send("hardhat_setBalance", [
      deployer.address,
      "0x11f9f2bea4c68000",
    ]);
    // Transfer 0.5 ETh from deployer to Contract Vault Address
    await deployer.sendTransaction({
      to: Calculum.address,
      value: ethers.utils.parseEther("0.5"),
    });
    console.log(`EPOCH_START : ${EPOCH_START}`);
    console.log(
      "Epoch Start Full Date: " +
        moment(EPOCH_TIME.utc(false).unix() * 1000)
          .utc(false)
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
        .utc(false)
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc(false));
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
    expect(await Calculum.transferBotWallet()).to.equal(
      transferBotWallet.address
    );
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
    expect(await Calculum.MIN_DEPOSIT()).to.equal(MIN_DEPOSIT);
    // Verify Max Deposit
    expect(await Calculum.MAX_DEPOSIT()).to.equal(MAX_DEPOSIT);
    // Verify Max Total Deposit into Vault
    expect(await Calculum.MAX_TOTAL_DEPOSIT()).to.equal(MAX_TOTAL_DEPOSIT);
    // Verify router address Uniswap V2
    expect(await Calculum.router()).to.equal(UNISWAP_ROUTER2);
    // Verify Balance of ERC20 USDc of the Contract Vault
    expect(await USDc.balanceOf(Calculum.address)).to.equal(200 * 10 ** 6);
    // Verify Balance of 0.5 ETH in ethereum of Contract Vault
    expect(await ethers.provider.getBalance(Calculum.address)).to.equal(
      ethers.utils.parseEther("0.5")
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
    )
      .to.revertedWithCustomError(Calculum, "VaultInMaintenance")
      .withArgs(deployer.address, `${timestamp + 1}`);
    // Move to after the Maintenance Time Post Maintenance
    const move1: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    console.log("Actual TimeStamp: ", move1.utc(false).unix());
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move1.add(maintTimeAfter, "s").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp after Add ${maintTimeAfter} seconds for Maintenance Window: `,
      moment(move1.unix() * 1000)
        .utc(false)
        .unix(),
      " Full Date: ",
      moment(move1.unix() * 1000)
        .utc(false)
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Getting Current Epoch and Next Epoch
    await Calculum.CurrentEpoch();
    const CURRECT_EPOCH = parseInt((await Calculum.CURRENT_EPOCH()).toString());
    console.log(`Number of Current Epoch: ${CURRECT_EPOCH}`);
    expect(2).to.equal(CURRECT_EPOCH);
    let currentEpoch: moment.Moment = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log(
      "TimeStamp Current Epoch: ",
      currentEpoch.utc(false),
      " TiemStamp Format: ",
      currentEpoch.utc(false).unix()
    );
    expect(currentEpoch.utc(false).unix()).to.equal(
      (await Calculum.EPOCH_START()).add(
        (await Calculum.EPOCH_DURATION()).mul(2)
      )
    );
    let nextEpoch: moment.Moment = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    expect(nextEpoch.utc(false).unix()).to.equal(
      currentEpoch.add(epochDuration, "s").utc(false).unix()
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc(false));
    // time before to set Epoch Duration
    const move2: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    console.log(
      "TimeStamp Before to Set Epoch Duration: ",
      move2.utc(false).unix()
    );
    // Setting the Value of Epoch Duration and Maintenance Time Before and After
    await Calculum.connect(deployer).setEpochDuration(
      epochDuration,
      maintTimeBefore,
      maintTimeAfter
    );
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
    // start Real Test of Epoch
  });

  afterEach(async () => {
    await network.provider.send("evm_mine", []);
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    console.log(
      "Verify TimeStamp: ",
      time,
      " Full Date: ",
      moment(time * 1000)
        .utc(false)
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    currentEpoch = moment(
      parseInt((await Calculum.getCurrentEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Current Epoch: ", currentEpoch.utc(false));
    nextEpoch = moment(
      parseInt((await Calculum.getNextEpoch()).toString()) * 1000
    );
    console.log("TimeStamp Next Epoch: ", nextEpoch.utc(false));
  });
});
