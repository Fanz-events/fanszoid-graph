import {
  SetUriCall,
  TransferBatch,
  TransferSingle,
} from "../../build/generated/Ticket/Ticket";
import { Event, Ticket, TicketBalance } from "../../build/generated/schema";
import {
  getTicketBalanceId,
  ticketHasNAmountAvailable
} from "../modules/TicketBalance";
import {
  getTicketId, ticketAttrs,
} from "../modules/Ticket";
import {
  loadOrCreateTransfer,
} from "../modules/Transfer";
import { loadOrCreateUser } from "../modules/User";
import { Address, log, store } from "@graphprotocol/graph-ts";
import { BigInt } from "@graphprotocol/graph-ts/common/numbers";
import { SetTicketUriCall } from "../../build/generated/Marketplace/Marketplace";
import { parseMetadata } from "./utils";

export function handleTransferSingle(event: TransferSingle): void {
  let to = event.params.to;
  let from = event.params.from;
  let id = event.params.id;
  let value =  event.params.value;

  internalTransferToken(to, from, id, value, event.transaction.hash.toHex(), event.block.timestamp);
}

export function handleTransferBatch(event: TransferBatch): void {
  let to = event.params.to;
  let from = event.params.from;
  let ids = event.params.ids;
  let values = event.params.values;

  for (let i = 0; i < ids.length; i++) {
    internalTransferToken(to, from, ids[i], values[i], event.transaction.hash.toHex(), event.block.timestamp);
  }
}

///////////////////////////////////////////////////////////////////
/////                   INTERNAL                              /////
///////////////////////////////////////////////////////////////////

function internalTransferToken(
  to: Address,
  from: Address,
  id: BigInt,
  value: BigInt,
  txHash: string,
  txTimestamp:BigInt 
): void {
  let zeroAddress = Address.fromString(
    "0x0000000000000000000000000000000000000000"
  );
  if (to != zeroAddress && from != zeroAddress) {
    loadOrCreateUser(from);
    loadOrCreateUser(to);

    let fromTicketBalance = TicketBalance.load(getTicketBalanceId(id, from));
    if( fromTicketBalance == null ){
      log.error("fromTicketBalance not found on internalTransferToken. ticket id : {}, address: {}", [ id.toHex(),from.toHex()]);
      return;
    }
    if( !ticketHasNAmountAvailable(fromTicketBalance, value.toI32()) ){
      log.error("fromTicketBalance.amount not enough on internalTransferToken. balance amount: {}, transfer value: {}", [fromTicketBalance.amountOwned.toString(), value.toI32().toString()]);
      return;
    }

    let eventEntity = Event.load(fromTicketBalance.event);
    if(eventEntity == null ) {
      log.error("Event not found on internalTransferToken. id : {}", [fromTicketBalance.event]);
      return;
    }

    fromTicketBalance.amountOwned = fromTicketBalance.amountOwned - value.toI32();

    let toTicketBalanceId = getTicketBalanceId(id, to)
    let toTicketBalance = TicketBalance.load(toTicketBalanceId);
    if( toTicketBalance == null ){
      toTicketBalance = new TicketBalance(toTicketBalanceId);
      toTicketBalance.ticket = getTicketId(id);
      toTicketBalance.event = fromTicketBalance.event;
      toTicketBalance.owner = to.toHex();
      toTicketBalance.isEventOwner = to.toHex() == eventEntity.organizer;
      toTicketBalance.amountOwned = value.toI32();
      toTicketBalance.amountOnSell = 0;
      if (toTicketBalance.owner != eventEntity.organizer) {
        eventEntity.attendees = eventEntity.attendees.plus(BigInt.fromI32(1));
      }
    } else {
      toTicketBalance.amountOwned = toTicketBalance.amountOwned + value.toI32();
    }

    let transfer = loadOrCreateTransfer(txHash);

    // the isSale field on transfer is only setted on the ticketBought handler
    transfer.event = fromTicketBalance.event;
    transfer.ticket = fromTicketBalance.ticket;
    transfer.sender = from.toHex();
    transfer.senderBalance = fromTicketBalance.id;
    transfer.receiver = to.toHex();
    transfer.receiverBalance = toTicketBalance.id;
    transfer.amount = value.toI32();
    transfer.createdAt = txTimestamp;
    transfer.save()

    if(fromTicketBalance.amountOwned == 0) {
      if (fromTicketBalance.owner != eventEntity.organizer) {
        eventEntity.attendees = eventEntity.attendees.minus(BigInt.fromI32(1));
      }
      store.remove(
        "TicketBalance",
        fromTicketBalance.id
      );
    } else {
      fromTicketBalance.save()
    }
    toTicketBalance.save();
    eventEntity.save();
  } else {
    log.info("Transfer single, to: {}, from: {}. Nothing done...", [
      to.toHex(),
      from.toHex(),
    ]);
  }
}

