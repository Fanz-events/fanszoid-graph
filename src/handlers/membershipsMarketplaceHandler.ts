import {
  MembershipPublished,
  MembershipsDeleted,
  AskSetted,
  AskRemoved,
  MembershipBought,
  CreatorRoyaltyModifiedOnMembership,
  MembershipEdited,
  AllowanceAdded,
  AllowanceRemoved,
  AllowanceConsumed,
  MembershipDeleted,
  MembershipPublished1
} from "../../build/generated/MembershipsMarketplace/MembershipsMarketplace";
import { Membership, Balance, Allowance,  } from "../../build/generated/schema";
import { 
  loadOrCreateEvent,
} from "../modules/Event";
import {
  getMembershipId, loadOrCreateMembership, membershipAttrs,
} from "../modules/Membership";
import {
  loadOrCreateTransfer,
} from "../modules/Transfer";
import { 
  getBalanceId,
  balanceHasNAmountAvailable,
  balanceHasNAmountOnSell,
  balancePriceMatches,
  getAllowanceId,
} from "../modules/Balance";
import { store, log, Address } from "@graphprotocol/graph-ts";
import { parseMetadata } from "./utils"
import { loadOrCreateUser } from "../modules/User";

export function handleAllowanceAdded(event: AllowanceAdded): void {
  let allowance = new Allowance(getAllowanceId(event.params.allowanceId, true));
  allowance.amount = event.params.allowance.amount.toI32();
  allowance.allowedAddresses = event.params.allowance.allowedAddresses.map<string>( (add:Address) => add.toHex());
  allowance.save();

  let membershipId = getMembershipId(event.params.membershipId)
  let membershipEntity = Membership.load(membershipId);
  if (!membershipEntity) {
    // not created yet. create it empty, it will be filled by handleTicketPublished
    membershipEntity = new Membership(membershipId);

    membershipEntity.organizer = "";
    membershipEntity.creatorRoyalty = 0;
    membershipEntity.isResellable = false;
    membershipEntity.totalAmount = 0;
    membershipEntity.isPrivate = false;
    membershipEntity.allowances = [allowance.id];
    membershipEntity.validTickets = [];
  } else {
    let allowances = membershipEntity.allowances
    if(allowances && allowances.length > 0) {
      allowances.push(allowance.id)
    } else {
      allowances = [allowance.id];
    }
    membershipEntity.allowances = allowances
  }

  membershipEntity.save();
}

export function handleAllowanceConsumed(event: AllowanceConsumed): void {
  let allowance = Allowance.load(getAllowanceId(event.params.allowanceId, true));
  if (!allowance) {
    log.error("Allowance Not Found on handleAllowanceConsumed. id : {}", [event.params.allowanceId.toString()]);
    return;
  }
  allowance.amount--;
  allowance.save();
}

export function handleAllowanceRemoved(event: AllowanceRemoved): void {
  let membershipEntity = Membership.load(getMembershipId(event.params.membershipId));
  if (!membershipEntity) {
    log.error("Membership Not Found on handleAllowanceAdded. id : {}", [event.params.membershipId.toString()]);
    return;
  }
  let allowanceLoaded = Allowance.load(getAllowanceId(event.params.allowanceId, true));
  if (!allowanceLoaded) {
    log.error("Allowance Not Found on handleAllowanceConsumed. id : {}", [event.params.allowanceId.toString()]);
    return;
  }
  let index = membershipEntity.allowances!.indexOf(allowanceLoaded.id);
  if ( membershipEntity.allowances === null || index == -1) {
    log.error("Allowance Not Found on saved. id : {}", [allowanceLoaded.id.toString()]);
    return;
  }
  
  let aux = membershipEntity.allowances || [];
  aux!.splice(index, 1);
  membershipEntity.allowances = aux;
  membershipEntity.save();
  store.remove(
    'Allowance',
    getAllowanceId(event.params.allowanceId, true)
  )
}

export function handleMembershipUriModification(event: MembershipEdited): void {
  let membershipEntity = Membership.load(getMembershipId(event.params.membershipId));
  if (!membershipEntity) {
    log.error("Membership Not Found on handleMembershipUriModification. id : {}", [event.params.membershipId.toString()]);
    return;
  }
  
  let parsed = parseMetadata(event.params.newUri, membershipEntity, membershipAttrs);
  
  if(parsed) {
    membershipEntity.metadata = event.params.newUri;
    membershipEntity.save();
  } else {
    log.error("Error parsing metadata on handleMembershipUriModification, metadata hash is: {}", [event.params.newUri])
  }
}

export function handleMembershipPublished(event: MembershipPublished1): void {
  let userEntity = loadOrCreateUser(
    event.params.organizer
  );

  let membership = loadOrCreateMembership(event.params.membershipId);
  membership.organizer = userEntity.address;
  membership.creatorRoyalty = event.params.saleInfo.royalty.toI32();
  membership.isResellable = event.params.saleInfo.isResellable;
  membership.metadata = event.params.uri;
  membership.totalAmount = event.params.amount.toI32();
  membership.isPrivate = event.params.saleInfo.isPrivate;
  membership.validTickets = [];
  
  let parsed = parseMetadata(event.params.uri, membership, membershipAttrs);
  
  if(parsed) {
    membership.save();

    let membershipBalance = Balance.load(getBalanceId(event.params.membershipId, event.params.organizer, true));
    if( membershipBalance !== null ){
      log.error("handleMembershipPublished: Balance already existed, id : {}", [getBalanceId(event.params.membershipId, event.params.organizer, true)]);
      return;
    }
    membershipBalance = new Balance(getBalanceId(event.params.membershipId, event.params.organizer, true));
    membershipBalance.membership = membership.id;
    membershipBalance.type = 'Membership';
    membershipBalance.askingPrice = event.params.saleInfo.price;
    membershipBalance.amountOnSell = event.params.saleInfo.amountToSell.toI32();
    membershipBalance.amountOwned = event.params.amount.toI32();
    membershipBalance.owner = event.params.organizer.toHex();
    membershipBalance.isEventOwner = true;
    membershipBalance.paymentTokenAddress = '0x0000000000000000000000000000000000000000';
    membershipBalance.ticketIdentifiersIds = [];

    membershipBalance.save();
  } else {
    log.error("Error parsing metadata on loadOrCreateMembership, metadata hash is: {}", [event.params.uri])
  }
  
}

export function handleMembershipDeleted(event: MembershipsDeleted): void {
  for (let i = 0; i < event.params.ids.length; i++) {
    let id = event.params.ids[i];
    let amount = event.params.amounts[i].toI32();

    let membershipBalanceId = getBalanceId(id, event.params.owner, true)
    let membershipBalance = Balance.load(membershipBalanceId);
    if(membershipBalance == null ){
      log.error("membershipBalance not found, id : {}", [membershipBalanceId]);
      return;
    }

    if( !balanceHasNAmountAvailable(membershipBalance, amount) ) {
      log.error("Not enough amount owned on membershipBalance, id : {}", [membershipBalanceId]);
      return;
    }

    membershipBalance.amountOwned = membershipBalance.amountOwned - amount;
    if( membershipBalance.amountOwned == 0 ) {
      store.remove(
        "Balance",
        membershipBalanceId
      );
    } else {
      membershipBalance.save()
    }

  }
}

/* 
  the handling on transferSingle/transferBatch does most of the entity updating for the membership balances.
*/
export function handleMembershipBought(event: MembershipBought): void {
  let amount = event.params.amount.toI32();

  let sellerBalance = Balance.load(getBalanceId(event.params.membershipId, event.params.seller, true));

  if( sellerBalance == null ){
    log.error("sellerBalance not found on handleMembershipBought. id : {}", [getBalanceId(event.params.membershipId, event.params.seller, true)]);
    return;
  }
  if( !balanceHasNAmountOnSell(sellerBalance, amount)  ){
    log.error("sellerBalance.amountOnSell not enough on internalTransferToken. balance amount: {}, transfer value: {}", [sellerBalance.amountOnSell.toString(), amount.toString()]);
    return;
  }

  sellerBalance.amountOnSell = sellerBalance.amountOnSell - amount;

  sellerBalance.save();

  let transfer = loadOrCreateTransfer(event.transaction.hash.toHex());
  transfer.price = event.params.price;
  transfer.isSale = true;

  transfer.save()
}

export function handleAskSetted(event: AskSetted): void {
  let membershipBalance = Balance.load(getBalanceId(event.params.membershipId, event.params.seller, true));
  if(membershipBalance != null ) {
    membershipBalance.amountOnSell = event.params.amount.toI32();
    membershipBalance.askingPrice = event.params.membershipPrice;
    
    membershipBalance.save();
  } else {
    log.error("membershipBalance not found on handleAskSetted. id : {}", [getBalanceId(event.params.membershipId, event.params.seller, true)]);
    return;
  }
}

export function handleAskRemoved(event: AskRemoved): void {
  let membershipBalance = Balance.load(getBalanceId(event.params.membershipId, event.params.seller, true));
  if(membershipBalance != null ) {
    membershipBalance.amountOnSell = 0;
    membershipBalance.askingPrice = null;
    
    membershipBalance.save();
  } else {
    log.error("membershipBalance not found on handleAskRemoved. id : {}", [getBalanceId(event.params.membershipId, event.params.seller, true)]);
    return;
  }
}

export function handleCreatorRoyaltyModifiedOnMembership(event: CreatorRoyaltyModifiedOnMembership): void {
  let membership = Membership.load(getMembershipId(event.params.membershipId));
  if(membership == null ) {
    log.error("Membership not found on handleCreatorRoyaltyModifiedOnMembership. id : {}", [event.params.membershipId.toHex()]);
    return;
  }

  membership.creatorRoyalty = event.params.newRoyalty.toI32();
  membership.save();
}

//////////////// Legacy /////////////////

export function handleMembershipPublishedLegacy(event: MembershipPublished): void {
  let userEntity = loadOrCreateUser(
    event.params.organizer
  );

  let membershipId = getMembershipId(event.params.membershipId);
  let membership = Membership.load(membershipId);
  if (membership != null) {
    log.error("handleMembershipPublished: MembershipType already existed, id : {}", [membershipId]);
    return;
  }

  membership = new Membership(membershipId);

  membership.organizer = userEntity.address;
  membership.creatorRoyalty = event.params.creatorRoyalty.toI32();
  membership.isResellable = event.params.isResellable;
  membership.metadata = event.params.uri;
  membership.totalAmount = event.params.amount.toI32();
  membership.isPrivate = false;
  membership.validTickets = [];

  let parsed = parseMetadata(event.params.uri, membership, membershipAttrs);

  if(parsed) {
    membership.save();
    let membershipBalance = Balance.load(getBalanceId(event.params.membershipId, event.params.organizer, true));
    if( membershipBalance !== null ){
      log.error("handleMembershipPublished: Balance already existed, id : {}", [getBalanceId(event.params.membershipId, event.params.organizer, true)]);
      return;
    }
    membershipBalance = new Balance(getBalanceId(event.params.membershipId, event.params.organizer, true));
    membershipBalance.membership = membershipId;
    membershipBalance.type = 'Membership';
    membershipBalance.askingPrice = event.params.price;
    membershipBalance.amountOnSell = event.params.amountToSell.toI32();
    membershipBalance.amountOwned = event.params.amount.toI32();
    membershipBalance.owner = event.params.organizer.toHex();
    membershipBalance.isEventOwner = true;
    membershipBalance.paymentTokenAddress = '0x0000000000000000000000000000000000000000';
    membershipBalance.ticketIdentifiersIds = [];

    membershipBalance.save();
  } else {
    log.error("Error parsing metadata on handleMembershipPublishedLegacy, metadata hash is: {}", [event.params.uri])
  }
  
}

export function handleMembershipDeletedLegacy(event: MembershipDeleted): void {
  for (let i = 0; i < event.params.ids.length; i++) {
    let id = event.params.ids[i];
    let amount = event.params.amounts[i].toI32();
    let membershipBalanceId = getBalanceId(id, event.params.owner, true)
    let membershipBalance = Balance.load(membershipBalanceId);
    if(membershipBalance == null ){
      log.error("membershipBalance not found, id : {}", [membershipBalanceId]);
      return;
    }
    if( !balanceHasNAmountAvailable(membershipBalance, amount) ) {
      log.error("Not enough amount owned on membershipBalance, id : {}", [membershipBalanceId]);
      return;
    }
    membershipBalance.amountOwned = membershipBalance.amountOwned - amount;
    if( membershipBalance.amountOwned == 0 ) {
      store.remove(
        "Balance",
        membershipBalanceId
      );
    } else {
      membershipBalance.save()
    }
  }
}