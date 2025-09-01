import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";

console.log("ethers:", typeof ethers);

describe("Debug Test", function () {
    it("Should check imports", async function () {
        console.log("hardhat imported");
        
        try {
            
            console.log("upgrades:", typeof upgrades);
            console.log("upgrades.deployProxy:", typeof upgrades?.deployProxy);
        } catch (error) {
            console.log("Error importing upgrades:", error);
        }

        // Try alternative import
        try {
            const openZeppelin = require("@openzeppelin/hardhat-upgrades");
            console.log("openZeppelin:", typeof openZeppelin);
            console.log("openZeppelin.upgrades:", typeof openZeppelin?.upgrades);
        } catch (error) {
            console.log("Error importing OpenZeppelin:", error);
        }

        // Try hre.upgrades
        try {
            console.log("hre.upgrades:", typeof hre.upgrades);
            console.log("hre.upgrades.deployProxy:", typeof hre.upgrades?.deployProxy);
        } catch (error) {
            console.log("Error accessing hre.upgrades:", error);
        }
        
        expect(true).to.be.true;
    });
});
