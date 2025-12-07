'use server'

import { sql, getNextTicketNumber, calculateWaitTime } from '@/lib/database'
import { revalidatePath } from 'next/cache'

export async function createTicket(serviceId: number, mobilePhone?: string) {
  try {
    const ticketNumber = await getNextTicketNumber(serviceId)
    const estimatedWaitTime = await calculateWaitTime(serviceId)
    
    const newTicket = await sql`
      INSERT INTO tickets (number, service_id, estimated_wait_time, mobile_phone)
      VALUES (${ticketNumber}, ${serviceId}, ${estimatedWaitTime}, ${mobilePhone})
      RETURNING *
    `
    
    revalidatePath('/dashboard')
    revalidatePath('/display')
    
    return { success: true, ticket: newTicket[0] }
  } catch (error) {
    console.error('Error creating ticket:', error)
    return { success: false, error: 'Failed to create ticket' }
  }
}

export async function callNextTicket(operatorId: number) {
  try {
    // Obtener el siguiente turno en espera
    const nextTicket = await sql`
      SELECT * FROM tickets 
      WHERE status = 'waiting'
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `
    
    if (!nextTicket.length) {
      return { success: false, error: 'No tickets waiting' }
    }
    
    // Actualizar el turno a "llamado"
    const updatedTicket = await sql`
      UPDATE tickets 
      SET status = 'called', operator_id = ${operatorId}, called_at = CURRENT_TIMESTAMP
      WHERE id = ${nextTicket[0].id}
      RETURNING *
    `
    
    revalidatePath('/dashboard')
    revalidatePath('/display')
    
    return { success: true, ticket: updatedTicket[0] }
  } catch (error) {
    console.error('Error calling next ticket:', error)
    return { success: false, error: 'Failed to call next ticket' }
  }
}

export async function startAttention(ticketId: number) {
  try {
    const updatedTicket = await sql`
      UPDATE tickets 
      SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
      WHERE id = ${ticketId}
      RETURNING *
    `
    
    revalidatePath('/dashboard')
    
    return { success: true, ticket: updatedTicket[0] }
  } catch (error) {
    console.error('Error starting attention:', error)
    return { success: false, error: 'Failed to start attention' }
  }
}

export async function completeTicket(ticketId: number) {
  try {
    const updatedTicket = await sql`
      UPDATE tickets 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ${ticketId}
      RETURNING *
    `
    
    revalidatePath('/dashboard')
    revalidatePath('/display')
    
    return { success: true, ticket: updatedTicket[0] }
  } catch (error) {
    console.error('Error completing ticket:', error)
    return { success: false, error: 'Failed to complete ticket' }
  }
}

export async function getQueueStatus() {
  try {
    const queueStatus = await sql`
      SELECT 
        s.id,
        s.name,
        s.prefix,
        s.estimated_time,
        COUNT(CASE WHEN t.status IN ('waiting', 'called') THEN 1 END) as waiting_count,
        AVG(CASE WHEN t.status = 'completed' AND DATE(t.created_at) = CURRENT_DATE 
            THEN EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/60 END) as avg_time_today
      FROM services s
      LEFT JOIN tickets t ON s.id = t.service_id AND DATE(t.created_at) = CURRENT_DATE
      WHERE s.active = true
      GROUP BY s.id, s.name, s.prefix, s.estimated_time
      ORDER BY s.priority
    `
    
    return queueStatus
  } catch (error) {
    console.error('Error getting queue status:', error)
    return []
  }
}
