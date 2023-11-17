import hre, { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();

  const Lib = await ethers.getContractFactory("Logic");
  const lib = await Lib.deploy();
  await lib.deployed();

  const contractFactory = await ethers.getContractFactory("Bcontract", {
    signer: signers[0],
    libraries: {
      Logic: lib.address,
    },
  });

  const contract = await contractFactory.deploy();
  //const contract = await ethers.deployContract("Bcontract");

  await contract.deployed();

  console.log("Bcontract deployed to:", contract.address);

  // Uncomment if you want to enable the `tenderly` extension
  // await hre.tenderly.verify({
  //   name: "Greeter",
  //   address: contract.address,
  // });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
