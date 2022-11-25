# Calculum Vault

Calculum v1 is the first version our Vault, based on ERC4626, with several improvement and adaptation

v1 changes include:

- Full compliance with ERC-4626
- Some improven of security
- Gas Cost improvement
- Integration with Trader Bot, API in the Unit-Test

v2 changes include:

- "Fair module", where the performance fee only apply if the user have a positive balance in your investment

## Getting Started

First, install the dependencies with yarn:

```bash
yarn install
```

Next, we need to populate the .env file with these values.\
Copy the .env.example -> .env and fill out the value.\
Reach out to the team if you need help on these variables. The `TEST_URI` needs to be an archive node.

```bash
MNEMONIC=
INFURAKEY=
PRIVATE_KEY=
DEPLOYER_ADDRESS=
COINMARKETCAP_API_KEY=
BSCSCAN_API_KEY=
ETHERSCAN_API_KEY=
POLYGON_API_KEY=
ALCHEMY_KEY=
URL_BSC=https://bsc-dataseed1.binance.org
URL_TESTNET_BSC=https://data-seed-prebsc-1-s1.binance.org:8545
URL_MOONBEAM_TESTNET=https://rpc.testnet.moonbeam.network
HTTP_HOST_TESTNET = https://api.stage.dydx.exchange
WS_HOST_TESTNET = wss://api.stage.dydx.exchange/v3/ws
ACCOUNTS=
```

Can run the Build of contracts

```bash
# Run all the tests
yarn build
```

Finally, we can run the tests:

```bash
# Run all the tests
yarn test
```

## Deployment

Calculum Vault V1 uses [hardhat-deploy](https://github.com/wighawag/hardhat-deploy) to manage contract deployments to the blockchain.

To deploy all the contracts in the Testnet for Short Support of ethereum forum to Sepolia, do

```
yarn deploy:sepolia
```

To deploy all the contracts in the Testnet for long Support of ethereum forum to Goerli, do

```
yarn deploy:testnet
```

## Testing

Will run all tests on Ethereum fork-mainnet based on Alchemy RPC

```
yarn test
```

Runs local Own Ethereum Node (Hardhat Local Node)

```
yarn test-local
```
