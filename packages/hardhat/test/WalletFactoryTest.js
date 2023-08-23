const { ethers, network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("MultiSigWallet Unit Test", function () {
          let WalletFactory, multiSigWallet, MultiSigWallet

          const CHAIN_ID = 31337

          const SIGNATURES_REQUIRED = 2

          beforeEach(async function () {
              [owner, signer1, signer2] = await ethers.getSigners()

              const WalletFactoryContract = await ethers.getContractFactory("WalletFactory")
              WalletFactory = await WalletFactoryContract.deploy()

              multiSigWallet = await WalletFactory.create(CHAIN_ID, [owner.address], SIGNATURES_REQUIRED)
              let [multiSigWalletAddress] = await WalletFactory.getMultiSig(0)

              let MultiSigWalletContract = await ethers.getContractFactory("MultiSigWallet")
              MultiSigWallet = await MultiSigWalletContract.attach(multiSigWalletAddress)
          })

          describe("Constructor", function () {
              it("initializes the MultiSigWallet correctly", async () => {
                  expect(await MultiSigWallet.chainId()).to.equal(CHAIN_ID)
                  expect(await MultiSigWallet.signaturesRequired()).to.equal(SIGNATURES_REQUIRED)
                  expect(await MultiSigWallet.isOwner(owner.address)).to.equal(true)

                  expect(await WalletFactory.existsMultiSig(MultiSigWallet.address)).to.equal(true)
                  expect(await WalletFactory.multiSigs(0)).to.equal(MultiSigWallet.address)
              })
              it("emit event on constructor", async () => {
                  const ownerConnected = await WalletFactory.connect(owner)
                  await expect(ownerConnected.create(CHAIN_ID, [owner.address, signer1.address], SIGNATURES_REQUIRED))
                  .to.emit(WalletFactory, "Create")

                  await expect(ownerConnected.create(CHAIN_ID, [owner.address, signer1.address], SIGNATURES_REQUIRED))
                  .to.emit(WalletFactory, "Owner")
              })
          })

          describe("NunmberOfMultiSigs", function () {
               it("get the number of created multiSig wallets",async () => {
                  expect(await WalletFactory.nunmberOfMultiSigs()).to.equal(1)
               })
          })

          describe("getMultiSig", function () {
               it("returns correct information", async () => {
                  let [walletAddress, signaturesRequired, contractBalance] = await WalletFactory.getMultiSig(0)
                  const multiSigWalletBalance = await ethers.provider.getBalance(MultiSigWallet.address)
                  assert.equal(walletAddress, MultiSigWallet.address)
                  assert.equal(signaturesRequired, SIGNATURES_REQUIRED)
                  assert.equal(multiSigWalletBalance.toString(), contractBalance.toString())
               })
          })

          describe("emitOwner", function () {
               it("should emit Owner event", async () => {
                const walletFactoryConnect = await WalletFactory.connect(owner)
                const owners = [owner.address, signer1.address]
                const emitOwnerTx = await walletFactoryConnect.emitOwner(MultiSigWallet.address, owners, SIGNATURES_REQUIRED)
                
                const txReceipt = await emitOwnerTx.wait()
                const ownerEvent = txReceipt.events.find(event => event.event === "Owner")
                
                expect(ownerEvent.args.contractAddress).to.equal(MultiSigWallet.address)
                expect(ownerEvent.args.owners).to.deep.equal(owners)
                expect(ownerEvent.args.signaturesRequired).to.equal(SIGNATURES_REQUIRED)
               })
          })
      })
