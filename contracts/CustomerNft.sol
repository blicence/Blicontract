// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

import "./nft/ERC1155OnChainMetadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract CustomerNft is ERC1155OnChainMetadata, Ownable {
    mapping(uint256 => bool) _ids;

    constructor() ERC1155OnChainMetadata() {}

    function mintWithMetadata(
        address to,
        uint256 id,
        uint256 planId,
        uint256 price,
        string memory name,
        string memory description,
        string memory imageURI
    ) public {
        require(
            _ids[id] == false,
            "ERC1155OnChainMetadata: mintWithMetadata: id already exists"
        );
        _setValue(id, key_token_planId, abi.encode(planId));
        _setValue(id, key_token_name, abi.encode(name));
        _setValue(id, key_token_description, abi.encode(description));
        _setValue(id, key_token_image, abi.encode(imageURI));

        _ids[id] = true;

        _mint(to, id, price, "");
        console.log("mint to {0}  anf {1}", to, id);
    }

    function createSVG() public pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "data:image/svg+xml;base64,",
                    Base64.encode(
                        bytes(
                            string(
                                abi.encodePacked(
                                    '<svg height="350" width="350" viewBox="0 0 350 350" xmlns="http://www.w3.org/2000/svg"><rect height="100%" width="100%" fill="white"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">HTML<animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 175 175" to="360 175 175" dur="2s" repeatCount="indefinite"/></text> SVG not supported. <style><![CDATA[ text {font: bold 50px Verdana, Helvetica, Arial, sans-serif;}]]></style></svg>'
                                )
                            )
                        )
                    )
                )
            );
    }

    function getPlanNftUri(uint256 tokenId)
        public
        view
        returns (string memory)
    {
        return uri(tokenId);
    }
}
