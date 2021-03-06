import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { assert, beforeAll, beforeEach, clearStore, describe, log, mockIpfsFile, newMockEvent, test } from "matchstick-as"
import { Allowance, Balance, Event, Ticket, User } from "../../build/generated/schema";
import { param, parseValue } from "../utils";
import { handleTransferBatch, handleTransferSingle } from "../../src/handlers/ticketsHandler";
import { getBalanceId } from "../../src/modules/Balance";
import { handleAllowanceAdded, handleAllowanceConsumed, handleAllowanceRemoved, handleAskRemoved, handleAskSetted, handleCreatorRoyaltyModifiedOnTicket, handleTicketBought, handleTicketDeleted, handleTicketPublished, handleTicketUriModification } from "../../src/handlers/ticketsMarketplaceHandler";
import { AllowanceAdded, AllowanceAddedAllowanceStruct, AllowanceConsumed, AllowanceRemoved, AskRemoved, AskSetted, CreatorRoyaltyModifiedOnTicket, TicketBought, TicketDeleted, TicketEdited, TicketPublished, TicketPublished1, TicketPublished1SaleInfoAllowancesStruct, TicketPublished1SaleInfoStruct, TicketsDeleted } from "../../build/generated/TicketsMarketplace/TicketsMarketplace";
import { getTicketId } from "../../src/modules/Ticket";


let address1:string = '';
let address2:string = '';
let org:string = '';

describe("TicketsMarketplace", () => {  

  beforeAll(() => {
    address1 = Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f').toHex();
    address2 = Address.fromString('0xB8dF7E9Beb10F5154eE98bd1c75f1F6BDDE94154').toHex();
    org = Address.fromString('0xa16081f360e3847006db660bae1c6d1b2e17ec2a').toHex();
  })
  beforeEach(() => {
      clearStore() // <-- clear the store before each test in the file
      let event = new Event("e0x0");
      event.organizer = org;
      event.save();

      let user1 = new User(address1);
      user1.save();
      let ticket = new Ticket(getTicketId(BigInt.fromString('0')));
      ticket.save();
      let balance1 = new Balance("t0x0-".concat(address1));
      balance1.type = 'Ticket';
      balance1.amountOwned = 5;
      balance1.event = 'e0x0';
      balance1.ticket = ticket.id;
      balance1.save();

      let user2 = new User(address2);
      user2.save();
  });


  test("Handle allowance added", () => {
    let mockEvent = newMockEvent();
    
    let event = new AllowanceAdded(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )

    let struct = new AllowanceAddedAllowanceStruct();
    struct[0] = parseValue(BigInt.fromString('1'));
    struct[1] = parseValue(['0x87d250a5c9674788F946F10E95641bba4DEa838f']);

    event.parameters = [
      param('ticketId', BigInt.fromString('0')),
      param('allowanceId', BigInt.fromString('1')),
      param('allowance', struct)
    ];

    assert.notInStore('Allowance', 'ta-0x1')
    handleAllowanceAdded(event)
    assert.fieldEquals('Allowance', 'ta-0x1', 'id', 'ta-0x1')
  });

  test("Handle allowance consumed", () => {
    let allowance = new Allowance("ta-0x1");
    allowance.amount = 2;
    allowance.save(); 
    
    let mockEvent = newMockEvent();
    
    let event = new AllowanceConsumed(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )

    event.parameters = [
      param('allowanceId', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Allowance', 'ta-0x1', 'amount', '2')
    handleAllowanceConsumed(event)
    assert.fieldEquals('Allowance', 'ta-0x1', 'amount', '1')
  });

  test("Handle allowance removed", () => {
    let allowance = new Allowance("ta-0x1");
    allowance.amount = 2;
    allowance.save(); 
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.allowances = ['ta-0x1'];
    ticket.save(); 
    
    let mockEvent = newMockEvent();
    
    let event = new AllowanceRemoved(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )

    event.parameters = [
      param('ticketId', BigInt.fromString('1')),
      param('allowanceId', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Allowance', 'ta-0x1', 'amount', '2')
    handleAllowanceRemoved(event)
    assert.notInStore('Allowance', 'ta-0x1')
  });

  test("Handle ticket uri modification", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.name = 'NAME';
    ticket.save(); 
    
    let mockEvent = newMockEvent();
    
    let event = new TicketEdited(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_2_ticket_metadata.json');

    event.parameters = [
      param('ticketId', BigInt.fromString('1')),
      param('newUri', 'FAKE_URI'),
    ];
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'NAME')
    handleTicketUriModification(event)
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'FAKE')
  });

  test("Handle ticket published", () => {   
    let eventInStorage = new Event("e0x0");
    eventInStorage.save();
  
    let mockEvent = newMockEvent();
    
    let event = new TicketPublished1(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    mockIpfsFile('FAKE_URI', 'tests/ipfs/fake_2_ticket_metadata.json');

    let allowance = new TicketPublished1SaleInfoAllowancesStruct();
    allowance[0] = parseValue(BigInt.fromString('1'));
    allowance[1] = parseValue(['0x87d250a5c9674788F946F10E95641bba4DEa838f']);

    let saleInfo = new TicketPublished1SaleInfoStruct();
    saleInfo[0] = parseValue(BigInt.fromString('10')); 
    saleInfo[1] = parseValue(BigInt.fromString('0')); 
    saleInfo[2] = parseValue(BigInt.fromString('0')); 
    saleInfo[3] = parseValue(BigInt.fromString('10')); 
    saleInfo[4] = ethereum.Value.fromBoolean(true); 
    saleInfo[5] = parseValue('FAKE_URI'); 
    saleInfo[6] = ethereum.Value.fromBoolean(true); 
    saleInfo[7] = parseValue([allowance]); 
    
    event.parameters = [
      param('eventId', BigInt.fromString('0')),
      param('organizer', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketId', BigInt.fromString('1')),
      param('amount', BigInt.fromString('10')),
      param('saleInfo', saleInfo),
      param('uri', 'FAKE_URI'),
    ];

    assert.notInStore('Ticket', 'tt0x1')
    handleTicketPublished(event)
    assert.fieldEquals('Ticket', 'tt0x1', 'event', 'e0x0')
    assert.fieldEquals('Ticket', 'tt0x1', 'name', 'FAKE')
    let balanceId = getBalanceId(BigInt.fromString('1'), Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), false);
    assert.fieldEquals('Balance', balanceId, 'amountOwned', '10')
  });

  test("Handle ticket deleted", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.name = 'NAME';
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new TicketsDeleted(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    event.parameters = [
      param('ids', [BigInt.fromString('1')]),
      param('owner', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('amounts', [BigInt.fromString('3')]),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOwned', '3')
    handleTicketDeleted(event)
    assert.notInStore('Balance', balanceId)
  });

  test("Handle ticket bought", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.name = 'NAME';
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.askingPrice = BigInt.fromString('10');
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new TicketBought(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    event.parameters = [
      param('ticketId', BigInt.fromString('1')),
      param('seller', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('buyer', '0xa16081f360e3847006db660bae1c6d1b2e17ec2a'),
      param('price', BigInt.fromString('10')),
      param('amount', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
    handleTicketBought(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '2')
    assert.fieldEquals('Transfer', event.transaction.hash.toHex(), 'isSale', 'true')
  });

  test("Handle ask setted", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.name = 'NAME';
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 0;
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new AskSetted(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    event.parameters = [
      param('ticketId', BigInt.fromString('1')),
      param('seller', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketPrice', BigInt.fromString('1')),
      param('amount', BigInt.fromString('3')),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '0')
    handleAskSetted(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
  });

  test("Handle ask removed", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.name = 'NAME';
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new AskRemoved(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    event.parameters = [
      param('seller', '0x87d250a5c9674788F946F10E95641bba4DEa838f'),
      param('ticketId', BigInt.fromString('1')),
    ];

    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '3')
    handleAskRemoved(event)
    assert.fieldEquals('Balance', balanceId, 'amountOnSell', '0')
  });

  test("Handle royalty modified", () => {
    let ticket = new Ticket(getTicketId(BigInt.fromString('1')));
    ticket.name = 'NAME';
    ticket.creatorRoyalty = 1;
    ticket.save(); 
    let balanceId = getBalanceId(
      BigInt.fromString('1'), 
      Address.fromString('0x87d250a5c9674788F946F10E95641bba4DEa838f'), 
      false
    );
    let balance = new Balance(balanceId);
    balance.ticket = 'tt0x1';
    balance.owner = '0x87d250a5c9674788F946F10E95641bba4DEa838f';
    balance.amountOwned = 3;
    balance.amountOnSell = 3;
    balance.save();
    
    let mockEvent = newMockEvent();
    
    let event = new CreatorRoyaltyModifiedOnTicket(
      mockEvent.address,
      mockEvent.logIndex,
      mockEvent.transactionLogIndex,
      mockEvent.logType,
      mockEvent.block,
      mockEvent.transaction,
      mockEvent.parameters,
      mockEvent.receipt
    )
    event.parameters = [
      param('ticketId', BigInt.fromString('1')),
      param('newRoyalty', BigInt.fromString('2')),
    ];

    assert.fieldEquals('Ticket', ticket.id, 'creatorRoyalty', '1')
    handleCreatorRoyaltyModifiedOnTicket(event)
    assert.fieldEquals('Ticket', ticket.id, 'creatorRoyalty', '2')
  });
})

// For coverage analysis
// Include all handlers beign tested
export { 
  handleAllowanceAdded, 
  handleAllowanceConsumed, 
  handleAllowanceRemoved, 
  handleAskRemoved, 
  handleAskSetted, 
  handleCreatorRoyaltyModifiedOnTicket, 
  handleTicketBought,
  handleTicketDeleted, 
  handleTicketPublished, 
  handleTicketUriModification
}