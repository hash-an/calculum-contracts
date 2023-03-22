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
    // Add deployer, alice, bob and carla wallet in the whitelist
    await Calculum.connect(deployer).addDropWhitelist(deployer.address, true);
    await Calculum.connect(deployer).addDropWhitelist(alice.address, true);
    await Calculum.connect(deployer).addDropWhitelist(bob.address, true);
    await Calculum.connect(deployer).addDropWhitelist(carla.address, true);
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
  let EPOCH_START: number;
  let EPOCH_TIME: moment.Moment;
  let CURRENT_EPOCH: number = 0;
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
    // get satrt time
    EPOCH_START = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    EPOCH_TIME = moment(EPOCH_START * 1000);
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
    // Add deployer, alice, bob and carla wallet in the whitelist
    await Calculum.connect(deployer).addDropWhitelist(deployer.address, true);
    await Calculum.connect(deployer).addDropWhitelist(alice.address, true);
    await Calculum.connect(deployer).addDropWhitelist(bob.address, true);
    await Calculum.connect(deployer).addDropWhitelist(carla.address, true);
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

  //   ** Verification of Sequence of Epoch based on Excel */
  //   ** 2. Verification of Sequence of Epoch */
  //   ** t1. First Epoch / Epoch 0 */
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
    const Current_Epoch = parseInt((await Calculum.CURRENT_EPOCH()).toString());
    console.log(`Number of Current Epoch: ${Current_Epoch}`);
    expect(CURRENT_EPOCH).to.equal(Current_Epoch);
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
        (await Calculum.EPOCH_DURATION()).mul(0)
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
    // Verify the maximal setting of deposit
    await expect(
      Calculum.connect(alice).deposit(150001 * 10 ** 6, alice.address)
    )
      .to.revertedWithCustomError(Calculum, "DepositExceededMax")
      .withArgs(alice.address, MAX_DEPOSIT);
    // Verify the minimal setting of deposit
    await expect(
      Calculum.connect(alice).deposit(29999 * 10 ** 6, alice.address)
    )
      .to.revertedWithCustomError(Calculum, "DepositAmountTooLow")
      .withArgs(alice.address, 29999 * 10 ** 6);
    // Alice Introduces the Asset to the Vault
    const balanceAliceBefore =
      parseInt((await USDc.balanceOf(alice.address)).toString()) / 10 ** 6;
    console.log(
      "Balance of Alice Before to Deposit in the Vault: ",
      balanceAliceBefore
    );
    // Verify deposits status of alice
    let depositsAlice = await Calculum.DEPOSITS(alice.address);
    expect(depositsAlice.status).to.equal(0);
    // Validate all Event Fire after Alice Deposit in the Vault
    expect(
      await Calculum.connect(alice).deposit(150000 * 10 ** 6, alice.address)
    )
      .to.emit(Calculum, "PendingDeposit")
      .withArgs(
        alice.address,
        alice.address,
        150000 * 10 ** 6,
        150000 * 10 ** 18
      )
      .to.emit(USDc, "Transfer")
      .withArgs(alice.address, Calculum.address, 150000 * 10 ** 6);
    console.log(`Alice deposits ${150000} tokens os USDc`);
    // update alice deposits
    depositsAlice = await Calculum.DEPOSITS(alice.address);
    // Validate Deposit in the Vault
    expect(depositsAlice.status).to.equal(1);
    expect(parseInt(depositsAlice.amountAssets.toString())).to.equal(
      150000 * 10 ** 6
    );
    expect(depositsAlice.amountShares).to.equal(
      ethers.utils.parseEther("150000")
    );
    expect(parseInt(depositsAlice.finalAmount.toString())).to.equal(0);
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
    expect(balanceAliceBefore - balanceAliceAfter).to.equal(150000);
    // Validate actual balance of ETH in the Calculum contract
    const balanceETH =
      parseInt(
        (await ethers.provider.getBalance(Calculum.address)).toString()
      ) /
      10 ** 18;
    expect(balanceETH).to.equal(5 / 10);
    // Validate actual balance of USDc in the Calculum contract (Minimal more deposit of Alice)
    const balanceUSDc =
      parseInt((await USDc.balanceOf(Calculum.address)).toString()) / 10 ** 6;
    expect(balanceUSDc).to.equal(200 + 150000);
    // Amount of Oracle is Cero, because is the Zero Epoch
    const move3: moment.Moment = moment(
      Math.floor((await ethers.provider.getBlock("latest")).timestamp) * 1000
    );
    // Move to Finalize Epoch
    console.log(
      "Actual TimeStamp: ",
      move3.utc(false).unix(),
      " Full Date: ",
      move3.utc(false).utc(false).format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Fail Try to Finalize the Epoch Before to Start Maintenance Window
    await expect(Calculum.connect(transferBotRoleAddress).finalizeEpoch())
      .to.revertedWithCustomError(Calculum, "VaultOutMaintenance")
      .withArgs(
        transferBotRoleAddress.address,
        Math.floor((await ethers.provider.getBlock("latest")).timestamp) + 1
      );
    // Move to Start Maintenance Window Pre Start
    const move4: moment.Moment = move3.add(
      epochDuration - (maintTimeBefore + maintTimeAfter),
      "s"
    );
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    console.log(
      `Verify TimeStamp before to Start the Second Maintenance Window: `,
      move4.utc(false).unix(),
      " Full Date: ",
      moment(move4.unix() * 1000)
        .utc(false)
        .format("dddd, MMMM Do YYYY, h:mm:ss a")
    );
    // Setting actual value of Assets
    await Oracle.connect(deployer).setAssetValue(150000 * 10 ** 6);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log("Finalize the First Epoch Successfully");
    depositsAlice = await Calculum.DEPOSITS(alice.address);
    // Verify changes in Alice Deposit
    expect(depositsAlice.status).to.equal(2);
    expect(parseInt(depositsAlice.amountAssets.toString())).to.equal(0);
    expect(depositsAlice.amountShares).to.equal(
      ethers.utils.parseEther("150000")
    );
    expect(parseInt(depositsAlice.finalAmount.toString())).to.equal(
      150000 * 10 ** 6
    );
    // Getting netTransfer Object
    const netTransfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    expect(netTransfer.pending).to.be.true;
    expect(netTransfer.direction).to.be.true;
    expect(parseInt(netTransfer.amount.toString()) / 10 ** 6).to.equal(150000);
    // Call dexTransfer to transfer the amount of USDc to the Vault
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(Calculum.address, transferBotWallet.address, 150000 * 10 ** 6)
      .to.emit(Calculum, "DexTransfer")
      .withArgs(await Calculum.CURRENT_EPOCH(), 150000 * 10 ** 6);
    console.log(
      "Transfer USDc from the Vault Successfully to Transfer Bot Wallet, Dex Transfer: ",
      parseInt(netTransfer.amount.toString()) / 10 ** 6
    );

    // Call FeeTransfer to transfer the amount of USDc to the Fee Address
    await expect(
      Calculum.connect(transferBotRoleAddress).feesTransfer()
    ).to.revertedWithCustomError(Calculum, "FirstEpochNoFeeTransfer");
    console.log(
      "Transfer USDc to the Treasury Successfully Fees Transfer: ",
      0
    );
    // Validate the Transfer of USDc to TraderBotWallet
    expect(
      parseInt((await USDc.balanceOf(transferBotWallet.address)).toString()) /
        10 ** 6
    ).to.equal(150000);
    // Validate the USDc into the Vautl (the minimal amount of Vault)
    expect(
      parseInt((await USDc.balanceOf(Calculum.address)).toString()) / 10 ** 6
    ).to.equal(200);
    // Validate the ETH into the Vautl (the minimal amount of Vault)
    expect(
      parseInt(
        (await ethers.provider.getBalance(Calculum.address)).toString()
      ) /
        10 ** 18
    ).to.equal(5 / 10);
    // Move to Start Maintenance Window Pre start next Epoch
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move4.add(60, "m").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    // Update Epoch
    await Calculum.CurrentEpoch();
    expect(await Calculum.CURRENT_EPOCH()).to.equal(1);
  });

  //   ** Verification of Sequence of Epoch based on Excel */
  //   ** 3. Verification of Sequence of Epoch */
  //   ** t1. Second Epoch / Epoch 1 */
  it("3.- Verification of Sequence of Epoch", async () => {
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
    // Revert if alice Try to Claim Her Shares in the Vault Maintenance Window
    await expect(Calculum.connect(alice).claimShares(alice.address))
      .to.revertedWithCustomError(Calculum, "VaultInMaintenance")
      .withArgs(alice.address, `${timestamp + 2}`);
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
    CURRENT_EPOCH = 1;
    const Current_Epoch = parseInt((await Calculum.CURRENT_EPOCH()).toString());
    console.log(`Number of Current Epoch: ${Current_Epoch}`);
    expect(CURRENT_EPOCH).to.equal(Current_Epoch);
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
        (await Calculum.EPOCH_DURATION()).mul(1)
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
    // Revert if Bob Try to Claim the Alice Shares
    await expect(Calculum.connect(bob).claimShares(alice.address))
      .to.revertedWithCustomError(Calculum, "CallerIsNotOwner")
      .withArgs(bob.address, alice.address);
    // Revert if Bob Try to Claim Something
    await expect(Calculum.connect(bob).claimShares(bob.address))
      .to.revertedWithCustomError(Calculum, "CalletIsNotClaimerToDeposit")
      .withArgs(bob.address);
    // Alice try to Claim your Vault tokens  (Shares)
    await expect(Calculum.connect(alice).claimShares(alice.address))
      .to.emit(Calculum, "Transfer")
      .withArgs(ZERO_ADDRESS, alice.address, ethers.utils.parseEther("150000"));
    console.log("Alice Claimed her Shares Successfully");
    // Verify all Storege Correctly in the Smart Contract
    expect(await Calculum.balanceOf(alice.address)).to.equal(
      ethers.utils.parseEther("150000")
    );
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).finalAmount.toString())
    ).to.equal(150000 * 10 ** 6);
    expect(
      parseInt((await Calculum.DEPOSITS(alice.address)).amountShares.toString())
    ).to.equal(0);
    expect((await Calculum.DEPOSITS(alice.address)).status).to.equal(3);
    // Try to Finalize the Epoch before the Finalization Time
    const time = Math.floor(
      (await ethers.provider.getBlock("latest")).timestamp
    );
    // Store the Value of assets in Mockup Oracle Smart Contract
    // with initial value
    await expect(Calculum.connect(transferBotRoleAddress).finalizeEpoch())
      .to.revertedWithCustomError(Calculum, "VaultOutMaintenance")
      .withArgs(transferBotRoleAddress.address, `${time + 1}`);
    // Move before to Maintenance Windows Pre Start
    await network.provider.send("evm_setNextBlockTimestamp", [
      parseInt(move1.add(epochDuration - maintTimeBefore, "s").format("X")),
    ]);
    await network.provider.send("evm_mine", []);
    // Setting actual value of Assets
    await Oracle.connect(deployer).setAssetValue(146250 * 10 ** 6);
    // Finalize the Epoch
    await Calculum.connect(transferBotRoleAddress).finalizeEpoch();
    console.log("Finalize the Second Epoch Successfully");
    // Getting netTransfer Object
    const netTransfer: any = await Calculum.netTransfer(
      await Calculum.CURRENT_EPOCH()
    );
    expect(netTransfer.pending).to.be.true;
    expect(netTransfer.direction).to.be.false;
    expect(parseInt(netTransfer.amount.toString()) / 10 ** 6).to.equal(
      288 / 10
    );
    // Call dexTransfer to transfer the amount of USDc to the Vault
    await expect(Calculum.connect(transferBotRoleAddress).dexTransfer())
      .to.emit(USDc, "Transfer")
      .withArgs(
        transferBotWallet.address,
        Calculum.address,
        parseInt(netTransfer.amount.toString())
      )
      .to.emit(Calculum, "DexTransfer")
      .withArgs(
        await Calculum.CURRENT_EPOCH(),
        parseInt(netTransfer.amount.toString())
      );
    console.log(
      "Transfer USDc from Transfer Bot Wallet to the Vault Successfully Dex Transfer: ",
      parseInt(netTransfer.amount.toString()) / 10 ** 6
    );
    // Verify the Balance of USDc in the Vault
    expect(
      parseInt((await USDc.balanceOf(transferBotWallet.address)).toString())
    ).to.equal(150000 * 10 ** 6 - parseInt(netTransfer.amount.toString()));
    // Call FeeTransfer to transfer the amount of USDc to the Fee Address
    await expect(Calculum.connect(transferBotRoleAddress).feesTransfer())
      .to.emit(Calculum, "FeesTransfer")
      .withArgs(
        await Calculum.CURRENT_EPOCH(),
        parseInt((await Calculum.CalculateTransferBotGasReserveDA()).toString())
      );
    // Verify the Balance of USDc of treasury in the Vault
    expect(
      parseInt((await USDc.balanceOf(treasuryWallet.address)).toString())
    ).to.equal(
      parseInt((await Calculum.CalculateTransferBotGasReserveDA()).toString())
    );
    console.log(
      "Transfer USDc to the Treasury Successfully Fees Transfer: ",
      parseInt((await Calculum.CalculateTransferBotGasReserveDA()).toString()) /
        10 ** 6
    );
  });

  afterEach(async () => {
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
