
import { ContractFactory, Wallet } from "ethers";
import { upgrades, ethers, network } from "hardhat";
 
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
 
import * as fs from 'fs';
import { ProxiesAddresses, PROXIES_ADDRESSES_FILENAME } from "../../scripts/v3/ProxiesAddresses";

 import {
    Framework,
    SuperToken,
    WrapperSuperToken,
} from "@superfluid-finance/sdk-core";
 
 import { deployTestFramework } from "@superfluid-finance/ethereum-contracts/dev-scripts/deploy-test-framework";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Provider } from "@ethersproject/providers";
import { TestToken } from "../../typechain-types/contracts/fortest/TestToken";
import TestTokenAbi from "../../artifacts/contracts/fortest/TestToken.sol/TestToken.json";
   export async function SadeTokenFixture(){
   
    const mockerc=await ethers.getContractFactory('MockERC20');
    console.log("sade token ");
    const token = await mockerc.deploy();
    await token.deployed();
    console.log("mockerc deployed to:", token.address);
    return  token  ;
  
}
 
  
 
export async function deployProxysFixture() {
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


  const Factory = await ethers.getContractFactory("Factory");
  // For now, BcontractFactory is not going to use UUPS proxy. When we try to convert it to this model
  // we start to receive errors about "contract code is too large". It demands a deeper analysis

  // The @openzeppelin/utils/Address, used on setGameImplementation function, has delegateCall,
  // then we need to include the 'unsafeAllow'. However, we made a restriction to setGameImplemention
  // be called only through proxy
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
  await producerApi.setProducerStorage(pstorage.address);
  console.log("producerApi setProducerStorage to:", pstorage.address);
  await producerNusage.setProducerStorage(pstorage.address);
  console.log("producerNusage setProducerStorage to:", pstorage.address);
  await producerVestingApi.setProducerStorage(pstorage.address);
  console.log("producerVestinfApi setProducerStorage to:", pstorage.address);
  await uriGenerator.setProducerStorage(pstorage.address);
  console.log("uriGenerator setProducerStorage to:", pstorage.address);
 
  proxyAddresses.FACTORY_PROXY_ADDRESS = factory.address;
  fs.writeFileSync(
    `./${PROXIES_ADDRESSES_FILENAME}`,
    JSON.stringify(proxyAddresses)
  );



  return {   urigenarator: uriGenerator, factory: factory,   pstorage: pstorage, producerApi: producerApi, producerNusage: producerNusage, producerVestingApi: producerVestingApi }
}

export async function userList() {

  const [
    owner,
    userA,
    userB,
    ProducerA,
    ProducerB,
    ProducerC]: SignerWithAddress[] = await ethers.getSigners();
  return { owner,userA, userB, ProducerA, ProducerB, ProducerC };

}

/* export async function testSuperfluid() {

  const signers = await ethers.getSigners();
  let owner=signers[0];
  let userA=signers[1];
  let userB=signers[2];
  let userC=signers[3];
  let ProducerA=signers[4];
  let ProducerB=signers[5];
  let ProducerC=signers[6];
  let SuperfluidFramework: Framework;
  let SuperToken: SuperToken;
  let Token: TestToken;


 
   const sfDeployer = await deployTestFramework();
    const contractsFramework = await sfDeployer.frameworkDeployer.getFramework();
    const provider = owner.provider!;
    const chainId = (await provider.getNetwork()).chainId;
    const frameworkClass = await Framework.create({
        chainId,
        resolverAddress: contractsFramework.resolver,
        provider: provider as unknown as Provider,
        protocolReleaseVersion: "test",
    });
    const sadeToken = await SadeTokenFixture();
    const tokenDeployment = await sfDeployer.frameworkDeployer.deployWrapperSuperToken(
        "Fake DAI Token",
        "fDAI",
        18,
        ethers.utils.parseEther("100000000").toString()
    );
    const fDAIx = (await frameworkClass.loadSuperToken(
        "fDAIx",
    )) as WrapperSuperToken;
    const fDAI = new ethers.Contract(
        fDAIx.underlyingToken.address,
       " TestTokenAbi.abi",
        owner,
    ) as unknown as TestToken;

    const initialAmount = ethers.utils.parseUnits("10000");
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i]!;
      await sadeToken.connect(signer).mint(signer.address, initialAmount, {
        from: signer.address,
    });
      await fDAI.connect(signer).mint(signer.address, initialAmount, {
          from: signer.address,
      });
      await fDAI
          .connect(signer)
          .approve(fDAIx.address, initialAmount, {
              from: signer.address,
          });

      const upgradeOp = fDAIx.upgrade({
          amount: initialAmount.toString(),
      });
      await upgradeOp.exec(signer);
  }

    return{
      frameworkClass,fDAIx,fDAI,chainId,sfDeployer,owner,userA, userB, ProducerA, ProducerB,ProducerC,sadeToken
    }
}

 */
 