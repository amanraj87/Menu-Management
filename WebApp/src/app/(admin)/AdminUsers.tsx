import { useState } from 'react'
import { Card, Button, Table, Thead, Tbody, Tr, Th, Td, Modal, Input, Loader } from '@/shared/ui'
import { useUsers, useCreateUser } from '@/shared/graphql/hooks'
import { useToastStore } from '@/shared/stores/toastStore'
import type { UserRole } from '@/shared/types'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'person', label: 'Person (chooses meals)' },
  { value: 'vendor', label: 'Vendor (updates menu)' },
  { value: 'admin', label: 'Admin' },
]

export function AdminUsers() {
  const [modalOpen, setModalOpen] = useState(false)
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('person')
  const toast = useToastStore()

  const { users, isLoading } = useUsers()
  const { createUser, isPending } = useCreateUser(
    () => {
      setModalOpen(false)
      setFormName('')
      setFormEmail('')
      setFormRole('person')
      toast.add('User added.', 'success')
    },
    (e) => toast.add(e.message, 'error')
  )

  const filtered = roleFilter ? users.filter((u) => u.role === roleFilter) : users

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createUser({ name: formName, email: formEmail, role: formRole })
  }

  return (
    <>
      <Card title="Users & vendors">
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Add users (persons who choose meals) and vendors (who update the menu). Only admins can create users.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem' }}>Role:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            className="input"
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="">All</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => { setModalOpen(true); setFormRole('person'); setFormName(''); setFormEmail(''); }}>
            + Add user
          </Button>
          <Button variant="outline" onClick={() => { setModalOpen(true); setFormRole('vendor'); setFormName(''); setFormEmail(''); }}>
            + Add vendor
          </Button>
        </div>
        {isLoading ? (
          <Loader />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((u) => (
                <Tr key={u._id}>
                  <Td>{u.name}</Td>
                  <Td>{u.email}</Td>
                  <Td>{u.role}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        {!isLoading && filtered.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>No users yet. Add a user or vendor above.</p>
        )}
      </Card>
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add user"
        footer={null}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Display name"
            required
          />
          <Input
            label="Email"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
          <div>
            <label className="input-label">Role</label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as UserRole)}
              className="input"
              style={{ width: '100%' }}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>Add</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
