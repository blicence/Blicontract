import * as fs from "fs";
import { ethers, upgrades } from "hardhat";
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "./ProxiesAddresses";

export async function deployProxys() {
  
  const [deployer, addr1, addr2] = await ethers.getSigners();
  const proxyAddresses: ProxiesAddresses = {
    FACTORY_PROXY_ADDRESS: "",
    URI_GENERATOR_PROXY_ADDRESS: "", 
    PRODUCER_STORAGE_PROXY_ADDRESS: "",
    PRODUCER_API_PROXY_ADDRESS: "",
    PRODUCER_NUSAGE_PROXY_ADDRESS: "",
    PRODUCER_VESTING_API_PROXY_ADDRESS: ""
  };
    
  console.log("Deploying contracts with the account:", deployer.address);

  //************** */
  const ProducerApi = await ethers.getContractFactory("ProducerApi");
  const producerApi = await upgrades.deployProxy(ProducerApi, [], { kind: "uups" });
  await producerApi.deployed();
  console.log("producerApi deployed to:", producerApi.address);
  proxyAddresses.PRODUCER_API_PROXY_ADDRESS = producerApi.address;

  //************** */
  const ProducerNusage = await ethers.getContractFactory("ProducerNUsage");
  const producerNusage = await upgrades.deployProxy(ProducerNusage, [], { kind: "uups" });
  await producerNusage.deployed();
  console.log("producerNusage deployed to:", producerNusage.address);
  proxyAddresses.PRODUCER_NUSAGE_PROXY_ADDRESS = producerNusage.address;
    //************** */
  const ProducerVestingApi = await ethers.getContractFactory("ProducerVestingApi");
  const producerVestingApi = await upgrades.deployProxy(ProducerVestingApi, [], { kind: "uups" });
  await producerVestingApi.deployed();
  console.log("producerVestinfApi deployed to:", producerVestingApi.address);
  proxyAddresses.PRODUCER_VESTING_API_PROXY_ADDRESS = producerVestingApi.address;

 

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

  //************** */
 
  // For now, BcontractFactory is not going to use UUPS proxy. When we try to convert it to this model
  // we start to receive errors about "contract code is too large". It demands a deeper analysis

  // The @openzeppelin/utils/Address, used on setGameImplementation function, has delegateCall,
  // then we need to include the 'unsafeAllow'. However, we made a restriction to setGameImplemention
  // be called only through proxy
  const Factory = await ethers.getContractFactory("Factory");
  const factory = await upgrades.deployProxy(
    Factory,
    [uriGenerator.address,pstorage.address,producerApi.address,producerNusage.address,producerVestingApi.address],
    {
      initializer: "initialize",
      unsafeAllow: ["delegatecall"],
    },
  );
  await factory.deployed(); 
  console.log("factory deployed to:", factory.address);
 
  await pstorage.setFactory(
    factory.address,
    producerApi.address,
    producerNusage.address,
    producerVestingApi.address
  );
  console.log("pstorage setFactory to:", factory.address);
  let tx1= await producerApi.setProducerStorage(pstorage.address);
  tx1.wait();
  console.log("producerApi setProducerStorage to:", pstorage.address);
  let tx2= await producerNusage.setProducerStorage(pstorage.address);
  tx2.wait();
  console.log("producerNusage setProducerStorage to:", pstorage.address);
  let tx3= await producerVestingApi.setProducerStorage(pstorage.address);
  tx3.wait();
  console.log("producerVestinfApi setProducerStorage to:", pstorage.address);
  let tx4=await uriGenerator.setProducerStorage(pstorage.address);
  tx4.wait();
  console.log("uriGenerator setProducerStorage to:", pstorage.address);
 
  proxyAddresses.FACTORY_PROXY_ADDRESS = factory.address;
  fs.writeFileSync(
    `./${PROXIES_ADDRESSES_FILENAME}`,
    JSON.stringify(proxyAddresses)
  );


 
  console.log(
    `*************** proxy addreses: '${PROXIES_ADDRESSES_FILENAME}' ***********`
  );


}
