import * as fs from "fs";
import {ethers, upgrades} from "hardhat";
import {ProxiesAddresses, PROXIES_ADDRESSES_FILENAME} from "../ProxiesAddresses";
 


 let  proxyAddresses: ProxiesAddresses = {
  FACTORY_PROXY_ADDRESS: "",
  URI_GENERATOR_PROXY_ADDRESS: "", 
  PRODUCER_STORAGE_PROXY_ADDRESS: "",
  PRODUCER_API_PROXY_ADDRESS: "",
  PRODUCER_NUSAGE_PROXY_ADDRESS: "",
  PRODUCER_VESTING_API_PROXY_ADDRESS: ""
  };

  function getProxyContractAddress(): string {
    proxyAddresses = JSON.parse(
      fs.readFileSync(`./${PROXIES_ADDRESSES_FILENAME}`).toString()
    );
    return proxyAddresses.PRODUCER_API_PROXY_ADDRESS;
  }

  
async function main() {
  const [deployer, addr1, addr2] = await ethers.getSigners();

  console.log("Upgrading ProducerLogic with the account:", deployer.address);

  //upgrade the deployed instance to a new version. The new version can be a different
  // contract (such as producer logic), or you can just modify the existing ProducerLogic contract
  //and recompile it - the plugin will note it changed.

  // While this plugin keeps track of all the implementation contracts you have deployed per
  // network, in order to reuse them and validate storage compatibilities, it does not keep
  // track of the proxies you have deployed. This means that you will need to manually keep
  // track of each deployment address, to supply those to the upgrade function when needed.

  // The plugin will take care of comparing new version of Contract to the previous one to
  // ensure they are compatible for the upgrade, deploy the new version implementation contract
  // (unless there is one already from a previous deployment), and upgrade the existing proxy to the new implementation.

  const PROXY_CONTRACT_ADDRESS = getProxyContractAddress();
  const prlogic = await ethers.getContractFactory("ProducerLogic");
/*   await upgrades.deployProxy(  prlogic ,{
    kind: "uups",
  })  */

  const deploy =  await upgrades.upgradeProxy( PROXY_CONTRACT_ADDRESS, prlogic ,{
    kind: "uups",
  }) 
 
   proxyAddresses.PRODUCER_API_PROXY_ADDRESS = deploy.address;
   fs.writeFileSync(
     `./${PROXIES_ADDRESSES_FILENAME}`,
     JSON.stringify(proxyAddresses)
   );
   console.log(
    `*************** proxy: '${PROXIES_ADDRESSES_FILENAME}' ***********`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
