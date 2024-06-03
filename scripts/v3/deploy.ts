
  import {ProxiesAddresses, PROXIES_ADDRESSES_FILENAME} from "./ProxiesAddresses";
  import * as fs from "fs";
import { Factory,Factory__factory,Producer,Producer__factory } from "../../typechain-types"
  const {ethers} = require("hardhat");
  
  async function main() {
    const [deployer] = await ethers.getSigners();
  
 
  
    // We get the contracts to deploy
    const Producer: Producer__factory = await ethers.getContractFactory("Producer");
    const producer: Producer = await Producer.deploy();
 
  
    const proxyAddresses: ProxiesAddresses = JSON.parse(
      fs.readFileSync(`./${PROXIES_ADDRESSES_FILENAME}`).toString()
    );
  
    const Factory: Factory =
      await ethers.getContractFactory("Factory"); 
       Factory.attach(
      proxyAddresses.FACTORY_PROXY_ADDRESS
    );
  
    const receipt = await Factory
      .connect(deployer)
      .setProducerImplementation(producer.address);
   
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
  