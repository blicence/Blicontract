// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;
 import {DataTypes} from "./../libraries/DataTypes.sol";

interface IURIGenerator {
  struct  UriMeta{
        uint256 custumerPlanId;
        uint256 planId; // planId is unique for each plan
        string producerName;
        address cloneAddress;
        string description; // description of the token
        string externalLink; // link to the token's website
        int256 totalSupply; // total number of tokens that can be minted
        int256 currentSupply; // number of tokens that have been minted
        string backgroundColor; // background color of the token
        string image; // image of the token
        address priceAddress; // address to which payments should be sent
        uint32 startDate; // the date when the plan starts
        uint32 endDate; // the date when the plan ends
        uint256 remainingQuota; // the monthly quota of the plan
        DataTypes.PlanTypes planType;
        DataTypes.Status status;
    }
 
    /**
     * @notice Constructs a URI for a claim NFT, encoding an SVG based on parameters of the claims lot.
     * @param params Parameters for the token URI.
     * @return A string with the SVG encoded in Base64.
     */
    function constructTokenURI(UriMeta memory params) external view returns (string memory);

    /**
     * @notice Generates a name for the NFT based on the supplied params.
     * @param params Parameters for the token URI.
     * @return A generated name for the NFT.
     */
    function generateName(UriMeta memory params) external pure returns (string memory);

    /**
     * @notice Generates a description for the NFT based on the supplied params.
     * @param params Parameters for the token URI.
     * @return A generated description for the NFT.
     */
    function generateDescription(UriMeta memory params) external pure returns (string memory);

    /**
     * @notice Generates a svg for the NFT based on the supplied params.
     * @param params Parameters for the token URI.
     * @return A generated svg for the NFT.
     */
    function generateNFT(UriMeta memory params) external view returns (string memory);
      function uri(
        uint256 tokenId
    ) external view returns (string memory);

      function mint(    DataTypes.CustomerPlan calldata vars
    )  external;
      function burn(    DataTypes.CustomerPlan calldata vars
    )   external;
   
   function  constructTokenUriApi(
        UriMeta memory params
    ) external view returns (string memory);


    function constructTokenUriVestingApi(
        UriMeta memory params
    ) external view returns (string memory);
 function constructTokenUriNUsage(
       UriMeta memory params
    ) external view returns (string memory);
}
