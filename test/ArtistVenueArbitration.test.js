const ArtistVenueArbitration = artifacts.require("ArtistVenueArbitration");
const XAOToken = artifacts.require("XAOToken");
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');

contract("ArtistVenueArbitration", accounts => {
    const [owner, artist, venue, eventContract] = accounts;
    const contractAmount = web3.utils.toWei("1", "ether");
    const depositAmount = web3.utils.toWei("0.1", "ether");

    let arbitration;
    let xaoToken;

    beforeEach(async () => {
        // Deploy XAO Token first
        xaoToken = await XAOToken.new({ from: owner });

        // Deploy Arbitration contract
        arbitration = await ArtistVenueArbitration.new(xaoToken.address, { from: owner });

        // Transfer some tokens to the arbitration contract for payments
        await xaoToken.transfer(arbitration.address, web3.utils.toWei("10", "ether"), { from: owner });
    });

    describe("Contract Initialization", () => {
        it("should initialize with correct token address", async () => {
            const tokenAddress = await arbitration.xaoToken();
            assert.equal(tokenAddress, xaoToken.address, "Token address not set correctly");
        });

        it("should revert if initialized with zero address", async () => {
            await expectRevert(
                ArtistVenueArbitration.new(
                    "0x0000000000000000000000000000000000000000",
                    { from: owner }
                ),
                "InvalidAddress"
            );
        });
    });

    describe("Filing Dispute", () => {
        it("should allow artist to file dispute", async () => {
            const tx = await arbitration.fileDispute(
                artist,
                venue,
                eventContract,
                contractAmount,
                depositAmount,
                { from: artist }
            );

            expectEvent(tx, 'DisputeFiled', {
                disputeId: new BN(0),
                artist: artist,
                venue: venue,
                contractAmount: new BN(contractAmount)
            });

            const dispute = await arbitration.getDispute(0);
            assert.equal(dispute.parties.artist, artist, "Artist not set correctly");
            assert.equal(dispute.parties.venue, venue, "Venue not set correctly");
            assert.equal(dispute.parties.eventContract, eventContract, "Event contract not set correctly");
            assert.equal(dispute.financials.contractAmount.toString(), contractAmount, "Contract amount not set correctly");
            assert.equal(dispute.state.status, 0, "Status should be Filed (0)");
        });

        it("should not allow non-party to file dispute", async () => {
            await expectRevert(
                arbitration.fileDispute(
                    artist,
                    venue,
                    eventContract,
                    contractAmount,
                    depositAmount,
                    { from: owner }
                ),
                "Unauthorized"
            );
        });

        it("should not allow zero event contract address", async () => {
            await expectRevert(
                arbitration.fileDispute(
                    artist,
                    venue,
                    "0x0000000000000000000000000000000000000000",
                    contractAmount,
                    depositAmount,
                    { from: artist }
                ),
                "InvalidAddress"
            );
        });
    });

    describe("Evidence Submission", () => {
        beforeEach(async () => {
            await arbitration.fileDispute(
                artist,
                venue,
                eventContract,
                contractAmount,
                depositAmount,
                { from: artist }
            );
        });

        it("should allow evidence submission by artist", async () => {
            const evidenceHash = web3.utils.keccak256("evidence");
            const tx = await arbitration.submitEvidence(0, evidenceHash, { from: artist });

            expectEvent(tx, 'EvidenceSubmitted', {
                disputeId: new BN(0),
                evidenceIPFSHash: evidenceHash
            });

            const dispute = await arbitration.getDispute(0);
            assert.equal(dispute.state.evidenceComplete, true, "Evidence should be marked complete");
            assert.equal(dispute.state.status, 2, "Status should be AIReview (2)");
        });

        it("should not allow duplicate evidence submission", async () => {
            const evidenceHash = web3.utils.keccak256("evidence");
            await arbitration.submitEvidence(0, evidenceHash, { from: artist });

            await expectRevert(
                arbitration.submitEvidence(0, evidenceHash, { from: artist }),
                "EvidenceAlreadySubmitted"
            );
        });

        it("should not allow evidence submission after period expires", async () => {
            await web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [6 * 24 * 60 * 60],
                id: new Date().getTime()
            }, () => {});

            const evidenceHash = web3.utils.keccak256("evidence");
            await expectRevert(
                arbitration.submitEvidence(0, evidenceHash, { from: artist }),
                "EvidencePeriodExpired"
            );
        });
    });
    describe("AI Decision", () => {
        beforeEach(async () => {
            await arbitration.fileDispute(
                artist,
                venue,
                eventContract,
                contractAmount,
                depositAmount,
                { from: artist }
            );
            await arbitration.submitEvidence(
                0,
                web3.utils.keccak256("evidence"),
                { from: artist }
            );
        });

        it("should allow owner to submit AI decision", async () => {
            const decisionHash = web3.utils.keccak256("decision");
            const approvedAmount = web3.utils.toWei("0.5", "ether");

            const tx = await arbitration.submitAIDecision(
                0,
                decisionHash,
                approvedAmount,
                false,
                1, // PartialPayment
                "Resolution details",
                { from: owner }
            );

            expectEvent(tx, 'AIDecisionIssued', {
                disputeId: new BN(0),
                decisionIPFSHash: decisionHash,
                approvedAmount: new BN(approvedAmount),
                refundsRequired: false,
                resolutionType: new BN(1)
            });

            const dispute = await arbitration.getDispute(0);
            assert.equal(dispute.state.aiDecisionIssued, true, "AI decision should be marked as issued");
            assert.equal(dispute.evidence.resolutionDetails, "Resolution details", "Resolution details not set correctly");
        });

        it("should not allow non-owner to submit AI decision", async () => {
            const decisionHash = web3.utils.keccak256("decision");
            const approvedAmount = web3.utils.toWei("0.5", "ether");

            await expectRevert(
                arbitration.submitAIDecision(
                    0,
                    decisionHash,
                    approvedAmount,
                    false,
                    1,
                    "Resolution details",
                    { from: artist }
                ),
                "Ownable: caller is not the owner"
            );
        });

        it("should not allow approved amount exceeding contract amount", async () => {
            const decisionHash = web3.utils.keccak256("decision");
            const invalidAmount = web3.utils.toWei("2", "ether"); // More than contract amount

            await expectRevert(
                arbitration.submitAIDecision(
                    0,
                    decisionHash,
                    invalidAmount,
                    false,
                    1,
                    "Resolution details",
                    { from: owner }
                ),
                "Approved amount exceeds contract"
            );
        });
    });

    describe("Resolution Execution", () => {
        beforeEach(async () => {
            await arbitration.fileDispute(
                artist,
                venue,
                eventContract,
                contractAmount,
                depositAmount,
                { from: artist }
            );
            await arbitration.submitEvidence(
                0,
                web3.utils.keccak256("evidence"),
                { from: artist }
            );
            await arbitration.submitAIDecision(
                0,
                web3.utils.keccak256("decision"),
                web3.utils.toWei("0.5", "ether"),
                false,
                1, // PartialPayment
                "Resolution details",
                { from: owner }
            );
        });

        it("should execute partial payment resolution", async () => {
            // Advance time past appeal period
            await web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [7 * 24 * 60 * 60], // 7 days
                id: new Date().getTime()
            }, () => {});

            const artistBalanceBefore = await xaoToken.balanceOf(artist);
            const venueBalanceBefore = await xaoToken.balanceOf(venue);

            const tx = await arbitration.executeResolution(0, { from: owner });

            expectEvent(tx, 'DisputeResolved', {
                disputeId: new BN(0),
                artistPayment: new BN(web3.utils.toWei("0.5", "ether")),
                venueRefund: new BN(web3.utils.toWei("0.5", "ether")),
                resolutionType: new BN(1)
            });

            const artistBalanceAfter = await xaoToken.balanceOf(artist);
            const venueBalanceAfter = await xaoToken.balanceOf(venue);

            assert.equal(
                artistBalanceAfter.sub(artistBalanceBefore).toString(),
                web3.utils.toWei("0.5", "ether"),
                "Artist should receive correct payment"
            );
            assert.equal(
                venueBalanceAfter.sub(venueBalanceBefore).toString(),
                web3.utils.toWei("0.5", "ether"),
                "Venue should receive correct refund"
            );
        });

        it("should not allow double execution", async () => {
            await web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [7 * 24 * 60 * 60],
                id: new Date().getTime()
            }, () => {});

            await arbitration.executeResolution(0, { from: owner });

            await expectRevert(
                arbitration.executeResolution(0, { from: owner }),
                "Resolution already executed"
            );
        });

        it("should not allow execution before appeal period ends", async () => {
            await expectRevert(
                arbitration.executeResolution(0, { from: owner }),
                "Resolution period not ended"
            );
        });
    });

    describe("Dispute Query Functions", () => {
        beforeEach(async () => {
            // Create multiple disputes
            await arbitration.fileDispute(artist, venue, eventContract, contractAmount, depositAmount, { from: artist });
            await arbitration.fileDispute(artist, venue, eventContract, contractAmount, depositAmount, { from: venue });
        });

        it("should return correct artist disputes", async () => {
            const disputes = await arbitration.getArtistDisputes(artist);
            assert.equal(disputes.length, 2, "Should have 2 disputes for artist");
            assert.equal(disputes[0].toString(), "0", "First dispute ID should be 0");
            assert.equal(disputes[1].toString(), "1", "Second dispute ID should be 1");
        });

        it("should return correct venue disputes", async () => {
            const disputes = await arbitration.getVenueDisputes(venue);
            assert.equal(disputes.length, 2, "Should have 2 disputes for venue");
            assert.equal(disputes[0].toString(), "0", "First dispute ID should be 0");
            assert.equal(disputes[1].toString(), "1", "Second dispute ID should be 1");
        });
    });

    describe("Contract Pause Functionality", () => {
        it("should allow owner to pause contract", async () => {
            await arbitration.pause({ from: owner });
            const isPaused = await arbitration.paused();
            assert.equal(isPaused, true, "Contract should be paused");
        });

        it("should prevent non-owner from pausing", async () => {
            await expectRevert(
                arbitration.pause({ from: artist }),
                "Ownable: caller is not the owner"
            );
        });

        it("should prevent operations while paused", async () => {
            await arbitration.pause({ from: owner });
            await expectRevert(
                arbitration.fileDispute(
                    artist,
                    venue,
                    eventContract,
                    contractAmount,
                    depositAmount,
                    { from: artist }
                ),
                "Pausable: paused"
            );
        });

        it("should allow owner to unpause contract", async () => {
            await arbitration.pause({ from: owner });
            await arbitration.unpause({ from: owner });
            const isPaused = await arbitration.paused();
            assert.equal(isPaused, false, "Contract should be unpaused");
        });
    });
});