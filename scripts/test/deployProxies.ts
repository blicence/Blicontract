import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "./ProxiesAddresses";

export async function deployProxys() {
  const [deployer, addr1, addr2] = await ethers.getSigners();
  const proxyAddresses: ProxiesAddresses = {
    PRODUCER_LOGIC_PROXY_ADDRESS: "",
    FACTORY_PROXY_ADDRESS: "",
    URI_GENERATOR_PROXY_ADDRESS: "", 
    PRODUCER_STORAGE_PROXY_ADDRESS: "",
  };
  console.log("Deploying contracts with the account:", deployer.address);

 

  const ProducerLogic = await ethers.getContractFactory("ProducerLogic");
  const producerLogic = await upgrades.deployProxy(ProducerLogic, [], {
    kind: "uups",
  });
  await producerLogic.deployed();
  console.log("producerLogic deployed to:", producerLogic.address);
  proxyAddresses.PRODUCER_LOGIC_PROXY_ADDRESS = producerLogic.address;
 

  //************** */
  const UriGenerator = await ethers.getContractFactory("URIGenerator");
  const uriGenerator = await upgrades.deployProxy(UriGenerator, [], {
    kind: "uups",
  });
  await uriGenerator.deployed();
  console.log("uriGenerator deployed to:", uriGenerator.address);
  proxyAddresses.URI_GENERATOR_PROXY_ADDRESS = uriGenerator.address;

  //************** */
  
 
  
 const Pstorage = await ethers.getContractFactory("ProducerStorage");
 const pstorage =await Pstorage.deploy();
 await pstorage.deployed();
 console.log("pstorage deployed to:", pstorage.address);
 proxyAddresses.PRODUCER_STORAGE_PROXY_ADDRESS = pstorage.address;


  const Factory = await ethers.getContractFactory("Factory");
  // For now, BcontractFactory is not going to use UUPS proxy. When we try to convert it to this model
  // we start to receive errors about "contract code is too large". It demands a deeper analysis

  // The @openzeppelin/utils/Address, used on setGameImplementation function, has delegateCall,
  // then we need to include the 'unsafeAllow'. However, we made a restriction to setGameImplemention
  // be called only through proxy

  const factory = await upgrades.deployProxy(
    Factory,
    [uriGenerator.address,producerLogic.address,pstorage.address],
    {
      initializer: "initialize",
      unsafeAllow: ["delegatecall"],
    },
  );
  await factory.deployed(); 
  console.log("factory deployed to:", factory.address);
 
 /*  await pstorage.setFactory(factory.address);
  console.log("pstorage setFactory to:", factory.address);
  */
  proxyAddresses.FACTORY_PROXY_ADDRESS = factory.address;
  fs.writeFileSync(
    `./${PROXIES_ADDRESSES_FILENAME}`,
    JSON.stringify(proxyAddresses)
  );
  console.log(
    `*************** proxy addreses: '${PROXIES_ADDRESSES_FILENAME}' ***********`
  );


}
