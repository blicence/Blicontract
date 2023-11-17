
  import {ProxiesAddresses, PROXIES_ADDRESSES_FILENAME} from "./ProxiesAddresses";
  import * as fs from "fs";
import { Factory,Factory__factory,Producer,Producer__factory } from "../../typechain-types"
  const {ethers} = require("hardhat");
  
  async function main() {
    const [deployer] = await ethers.getSigners();
  
    console.log("Deploying contract Bcontractv2 with the account:", deployer.address);
  
    // We get the contracts to deploy
    const Producer: Producer__factory = await ethers.getContractFactory("Producer");
    const producer: Producer = await Producer.deploy();
    console.log("Producer deployed to:", producer.address);
  
    const proxyAddresses: ProxiesAddresses = JSON.parse(
      fs.readFileSync(`./${PROXIES_ADDRESSES_FILENAME}`).toString()
    );
  
    const Factory: Factory =
      await ethers.getContractFactory("Factory"); 
       Factory.attach(
      proxyAddresses.FACTORY_PROXY_ADDRESS
    );
    console.log(
      `Previous Producer implementation: ${await Factory.getProducerImplementation()}`
    );
    const receipt = await Factory
      .connect(deployer)
      .setProducerImplementation(producer.address);
    console.log(
      `Transaction to change implementation sent. Waiting for confirmation ...`
    );
    await receipt.wait();
    console.log(
      `New Producer implementation: ${await Factory.getProducerImplementation()}`
    );
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  