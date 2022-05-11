import {
  EventCreated,
  EventDeleted,
  EventOwnershipTransferred,
  CreatorRoyaltyModifiedOnEvent,
  EventEdited,
  MembershipAssignedToTicket,
  MembershipTokenIdRemovedFromTicket,
  MembershipRemovedFromTicket
} from "../../build/generated/Admin/Admin";
import { Event, Ticket, Balance, AllowedMembership } from "../../build/generated/schema";
import {
  getAllowedMembershipId, membershipAttrs,
} from "../modules/Membership";
import { loadOrCreateUser } from "../modules/User";
import { 
  loadOrCreateEvent,
  getEventId,
  eventAttrs
} from "../modules/Event";
import { store, log, BigInt } from "@graphprotocol/graph-ts";
import { parseMetadata } from "./utils"
import { getTicketId } from "../modules/Ticket";

export function handleEventUriModification(event: EventEdited): void {
  let eventEntity = Event.load(getEventId(event.params.eventId));
  if (!eventEntity) {
    log.error("Event Not Found on handleEventUriModification. id : {}", [event.params.eventId.toString()]);
    return;
  }
  parseMetadata(event.params.newUri, eventEntity, eventAttrs);
  eventEntity.metadata = event.params.newUri;
  eventEntity.save();
}

export function handleEventCreated(event: EventCreated): void {
  let organizerUser = loadOrCreateUser(event.params.organizer);
  let eventEntity = loadOrCreateEvent(
    event.params.eventId
  );

  eventEntity.metadata = event.params.uri;
  parseMetadata(event.params.uri, eventEntity, eventAttrs);
    
  eventEntity.organizer = organizerUser.address.toHex();
  eventEntity.save();
}

export function handleEventDeleted(event: EventDeleted): void {
  store.remove(
    "Event",
    getEventId(event.params.eventId)
  );
}

export function handleMembershipsAssigned(event: MembershipAssignedToTicket): void {
  let ticketEntity = Ticket.load(getTicketId(event.params.ticketId));
  if(ticketEntity == null ) {
    log.error("Ticket Not Found on handleMembershipsAssigned. id : {}", [event.params.ticketId.toHex()]);
    return;
  }
  let allowedMembership = new AllowedMembership(getAllowedMembershipId(ticketEntity.id, event.params.contractAddress.toHex()));
  allowedMembership.address = event.params.contractAddress;
  allowedMembership.tokenIds = event.params.ids;
  allowedMembership.ticket = ticketEntity.id
  allowedMembership.save();
}

export function handleDisallowMembership(event: MembershipRemovedFromTicket): void {
  let ticketEntity = Ticket.load(getTicketId(event.params.ticketId));
  if(ticketEntity == null ) {
    log.error("Ticket Not Found on handleDisallowMembership. id : {}", [event.params.ticketId.toHex()]);
    return;
  }
  store.remove(
    "AllowedMembership",
    getAllowedMembershipId(ticketEntity.id, event.params.contractAddress.toHex())
  );
}

export function handleDisallowMembershipTokenId(event: MembershipTokenIdRemovedFromTicket): void {
  let ticketEntity = Ticket.load(getTicketId(event.params.ticketId));
  if(ticketEntity == null ) {
    log.error("Ticket Not Found on handleDisallowMembershipTokenId. id : {}", [event.params.ticketId.toString()]);
    return;
  };
  let allowedMembershipId = getAllowedMembershipId(ticketEntity.id, event.params.contractAddress.toHex())
  let allowedMembership = AllowedMembership.load(allowedMembershipId);
  if(allowedMembership == null ) {
    log.error("AllowedMembership Not Found on handleDisallowMembershipTokenId. id : {}", [allowedMembershipId]);
    return;
  };
  let currentIds = allowedMembership.tokenIds as BigInt[];
  let finalIds: Array<BigInt> = new Array<BigInt>();
  for (let j = 0 ; j < currentIds.length ; j++) {
    let id = currentIds[j];
    if (id != event.params.tokenId) {
      finalIds.push(id);
    }
  }
  allowedMembership.tokenIds = finalIds;
  allowedMembership.save();
}

export function handleEventOwnershipTransferred(event: EventOwnershipTransferred): void {
  let eventEntity = Event.load(getEventId(event.params.eventId));
  
  if(eventEntity == null ) {
    log.error("Event not found on handleEventOwnershipTransferred. id : {}", [event.params.eventId.toHex()]);
    return;
  }

  let ownerUser = loadOrCreateUser(event.params.newOwner);
  eventEntity.organizer = ownerUser.id;

  eventEntity.save();

  for( let i = 0; i< eventEntity.ticketBalances.length ; i++ ){
    let tb = eventEntity.ticketBalances[i]
    let ticketBalance = Balance.load(tb);
    if(ticketBalance == null ) {
      log.error("Balance not found on handleEventOwnershipTransferred. id : {}", [tb]);
      return;
    }

    if( ticketBalance.owner === ownerUser.id ) {
      ticketBalance.isEventOwner = true;
    } else {
      ticketBalance.isEventOwner = false;
    }
    ticketBalance.save();
  }
}

export function handleCreatorRoyaltyModifiedOnEvent(event: CreatorRoyaltyModifiedOnEvent): void {
  let eventEntity = Event.load(getEventId(event.params.eventId));
  if(eventEntity == null ) {
    log.error("Event not found on handleEventOwnershipTransferred. id : {}", [event.params.eventId.toHex()]);
    return;
  }

  for( let i = 0; i< eventEntity.tickets.length ; i++ ){
    let t = eventEntity.tickets[i]
    let ticket = Ticket.load(t);
    if(ticket == null ) {
      log.error("Ticket not found on handleCreatorRoyaltyModifiedOnEvent. id : {}", [t]);
      return;
    }
    
    ticket.creatorRoyalty = event.params.newRoyalty.toI32();
    ticket.save();
  }
}