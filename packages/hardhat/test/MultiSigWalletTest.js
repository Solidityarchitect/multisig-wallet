const { ethers, network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("MultiSigWallet Unit Test", function () {
          let WalletFactory, MultiSigWallet, provider

          const CHAIN_ID = 31337

          const SIGNATURES_REQUIRED = 2

          beforeEach(async function () {
              [owner, signer1, signer2, signer3] = await ethers.getSigners()

              const WalletFactoryContract = await ethers.getContractFactory("WalletFactory")
              WalletFactory = await WalletFactoryContract.deploy()

              multiSigWallet = await WalletFactory.create(CHAIN_ID, [owner.address, signer1.address, signer2.address], SIGNATURES_REQUIRED)
              let [multiSigWalletAddress] = await WalletFactory.getMultiSig(0)

              let MultiSigWalletContract = await ethers.getContractFactory("MultiSigWallet")
              MultiSigWallet = await MultiSigWalletContract.attach(multiSigWalletAddress)
              
              await owner.sendTransaction({
                to: MultiSigWallet.address,
                value: ethers.utils.parseEther("10")
          })
            provider = owner.provider
    })

    describe("Constructor", function () {
        it("initializes the MultiSigWallet correctly", async () => {
            expect(await MultiSigWallet.chainId()).to.equal(CHAIN_ID)
            expect(await MultiSigWallet.signaturesRequired()).to.equal(SIGNATURES_REQUIRED)
            expect(await MultiSigWallet.isOwner(owner.address)).to.equal(true)
            expect(await MultiSigWallet.owners(0)).to.equal(owner.address)
        })
    })
    
    describe("addSigner", function () {
        it("add a new owner", async () => {
            const newSigner = signer3.address
            const nonce = await MultiSigWallet.nonce()
            const to = MultiSigWallet.address
            const value = 0
      
            const callData = MultiSigWallet.interface.encodeFunctionData("addSigner", [newSigner, 2])
            const hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData)

            const signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            const signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))

            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            await MultiSigWallet.executeTransaction(to, value, callData, [signature2, signature1])
            expect(await MultiSigWallet.isOwner(newSigner)).to.equal(true)
        })
    })
    
    describe("removeSigner", function() {
        it("remove a signer", async () => {
            const oldSigner = signer2.address
            const nonce = await MultiSigWallet.nonce()
            const to = MultiSigWallet.address
            const value = 0

            const callData = MultiSigWallet.interface.encodeFunctionData("removeSigner", [oldSigner, 2])
            const hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData)

            const signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            const signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))

            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            await MultiSigWallet.executeTransaction(to, value, callData, [signature2, signature1])
            expect(await MultiSigWallet.isOwner(oldSigner)).to.equal(false)

        })
    })

    describe("updateSignaturesRequired", function () {
        it("update SignaturesRequired to 3", async () => {
            let nonce = await MultiSigWallet.nonce()
            let value = 0
            let to = MultiSigWallet.address
            let newSigner = signer3.address

            let callData = MultiSigWallet.interface.encodeFunctionData("addSigner", [newSigner, 2])
            let hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData)

            let signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            let signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))
            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            await MultiSigWallet.executeTransaction(to, value, callData, [signature2, signature1])

            nonce = await MultiSigWallet.nonce()
            to = MultiSigWallet.address
            value = 0

            callData = MultiSigWallet.interface.encodeFunctionData("updateSignaturesRequired", [3])
            hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData)

            signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))
            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            await MultiSigWallet.executeTransaction(to, value, callData, [signature2, signature1])
            expect(await MultiSigWallet.signaturesRequired()).to.equal(3)
        })
        
        it("transfering 0.1 ETH to signer1", async () => {
            let startingBalance = await provider.getBalance(signer1.address)
            let to = signer1.address
            let value = ethers.utils.parseEther("0.1")
            let nonce = await MultiSigWallet.nonce()

            let callData = "0x00"
            let hash = await MultiSigWallet.getTransactionHash(nonce, to, value.toString(), callData)

            let signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            let signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))
            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            await MultiSigWallet.executeTransaction(to, value.toString(), callData, [signature2, signature1])
            let endingBalance = await provider.getBalance(signer1.address)
            expect(endingBalance).to.equal(startingBalance.add(value))
            console.log(`MultiSigWallet Contract Balance: ${ethers.utils.formatEther(endingBalance)}`) 
        })
    })

    describe("openStream", function () {
        it("should open a new stream", async () => {
            let TO = signer1.address
            let AMOUNT = ethers.utils.parseEther("10")
            let FREQUENCY = 5
            let nonce = await MultiSigWallet.nonce()
            let value = 0
            let to = MultiSigWallet.address

            let callData = MultiSigWallet.interface.encodeFunctionData("openStream", [TO, AMOUNT, FREQUENCY])
            let hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData)

            let signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            let signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))
            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            const openStreamTx = await MultiSigWallet.executeTransaction(to, value, callData, [signature2, signature1])
            const txReceipt = await openStreamTx.wait()
            
            const openStreamEvent = txReceipt.events.find((event) => event.event === "OpenStream")
            expect(openStreamEvent.args.to).to.equal(TO)
            expect(openStreamEvent.args.amount).to.equal(AMOUNT)
            expect(openStreamEvent.args.frequency).to.equal(FREQUENCY)

            const startingBalance = await ethers.provider.getBalance(MultiSigWallet.address)
            console.log(`MultiSigWallet Contract Balance: ${ethers.utils.formatEther(startingBalance)}`)  
        })
    })

    describe("streamsWithdraw", function () {
        it("should withdraw from an open stream", async () => {

            // Open a stream first
            let TO = signer1.address
            let AMOUNT = ethers.utils.parseEther("15")
            let REASON = "Pay water bill"
            let FREQUENCY = 5
            let nonce = await MultiSigWallet.nonce()
            let value = 0
            let to = MultiSigWallet.address

            let callData = MultiSigWallet.interface.encodeFunctionData("openStream", [TO, AMOUNT, FREQUENCY])
            let hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData)

            let signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            let signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))

            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            await MultiSigWallet.connect(signer1).executeTransaction(to, value, callData, [signature2, signature1])
            const startingBalance = await ethers.provider.getBalance(MultiSigWallet.address)
            console.log(`MultiSigWallet Contract Balance: ${ethers.utils.formatEther(startingBalance)}`)  

            // Withdraw 2 ETH
            const withdrawTx = await MultiSigWallet.connect(signer1).streamWithdraw(ethers.utils.parseEther("3"), REASON);
            await withdrawTx.wait()

            const endingBalance = await ethers.provider.getBalance(MultiSigWallet.address)
            console.log(`MultiSigWallet Contract Balance: ${ethers.utils.formatEther(endingBalance)}`)  
        })

        it("should fail if trying to withdraw more than available balance", async () => {
            
            // Open a stream first
            let TO = signer1.address
            let AMOUNT = ethers.utils.parseEther("10")
            let REASON = "Pay water bill"
            let FREQUENCY = 5
            let nonce = await MultiSigWallet.nonce()
            let value = 0
            let to = MultiSigWallet.address

            let callData = MultiSigWallet.interface.encodeFunctionData("openStream", [TO, AMOUNT, FREQUENCY])
            let hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData)

            let signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            let signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))

            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            await MultiSigWallet.connect(owner).executeTransaction(to, value, callData, [signature2, signature1])

            // Withdraw more than available balance, should revert a error
            await expect(MultiSigWallet.connect(signer1).streamWithdraw(ethers.utils.parseEther("12"), REASON)).to.be.revertedWith("Not enough")
        })
    })

    describe("closeStream", function () {
        it("emits event on close", async () => {
             // Open a stream first
            let TO = owner.address
            let AMOUNT = 15
            let FREQUENCY = 5
            let nonce = await MultiSigWallet.nonce()
            let value = 0
            let to = MultiSigWallet.address

            let callData = MultiSigWallet.interface.encodeFunctionData("openStream", [TO, AMOUNT, FREQUENCY])
            let hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData)

            let signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            let signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))

            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            await MultiSigWallet.connect(signer1).executeTransaction(to, value, callData, [signature2, signature1])
            const startingBalance = await ethers.provider.getBalance(MultiSigWallet.address)
            console.log(`MultiSigWallet Contract Balance: ${ethers.utils.formatEther(startingBalance)}`)  

            // Close a stream
            nonce = await MultiSigWallet.nonce()
            to = owner.address

            callData = MultiSigWallet.interface.encodeFunctionData("closeStream", [to])
            hash = await MultiSigWallet.getTransactionHash(nonce, to, value, callData)

            signature1 = await owner.signMessage(ethers.utils.arrayify(hash))
            signature2 = await signer1.signMessage(ethers.utils.arrayify(hash))

            expect(await MultiSigWallet.recover(hash, signature1)).to.equal(owner.address)
            expect(await MultiSigWallet.recover(hash, signature2)).to.equal(signer1.address)

            await MultiSigWallet.executeTransaction(to, value, callData, [signature2, signature1])
            const endingBalance = await ethers.provider.getBalance(MultiSigWallet.address)
            console.log(`MultiSigWallet Contract Balance After Closing Stream: ${ethers.utils.formatEther(endingBalance)}`)
        })
    })
})