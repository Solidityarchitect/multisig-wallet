//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./MultiSigWallet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WalletFactory is Ownable{
    // Type Declarations
    MultiSigWallet[] public multiSigs;

    // State variables
    mapping(address => bool) public existsMultiSig;

    // Events
    event Create(
        uint256 indexed contractId,
        address indexed contractAddress,
        address creator,
        address[] owners,
        uint256 indexed signaturesRequired
    );
    event Owner(
        address indexed contractAddress,
        address[] owners,
        uint256 indexed signaturesRequired
    );

    // Public Function
    function create(
        uint256 chainId,
        address[] memory owners,
        uint256 signaturesRequired
    ) public payable {
        uint256 walletId = multiSigs.length;
        MultiSigWallet multiSig = new MultiSigWallet{value: msg.value}(
            chainId,
            owners,
            signaturesRequired,
            payable(address(this))
        );
        address walletAddress = address(multiSig);
        require(!existsMultiSig[walletAddress], "Wallet already exists");

        multiSigs.push(multiSig);
        existsMultiSig[address(multiSig)] = true;
        emit Create(
            walletId,
            walletAddress,
            msg.sender,
            owners,
            signaturesRequired
        );
        emit Owner(walletAddress, owners, signaturesRequired);
    }

    // Get Function
    function nunmberOfMultiSigs() public view returns (uint256) {
        return multiSigs.length;
    }

    function getMultiSig(
        uint256 index
    )
        public
        view
        returns (
            address walletAddress,
            uint256 signaturesRequired,
            uint256 balance
        )
    {
        MultiSigWallet wallet = multiSigs[index];
        walletAddress = address(wallet);
        signaturesRequired = wallet.signaturesRequired();
        balance = address(wallet).balance;
    }

    function emitOwner(
        address contractAddress,
        address[] memory owners,
        uint256 signaturesRequired
    ) external onlyOwner{
        emit Owner(contractAddress, owners, signaturesRequired);
    }


    // Receive
    receive() external payable {}
}
// Pragma statements
// Import statements
// Interfaces
// Libraries
// Contracts
// Inside each contract, library or interface, use the following order:
// Type declarations
// State variables
// Events
// Errors
// Modifiers
// Functions
