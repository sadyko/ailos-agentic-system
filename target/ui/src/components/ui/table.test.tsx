import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from '@/components/ui/table'

describe('ui/Table (smoke)', () => {
  it('mounts and has no axe violations', async () => {
    const { container } = render(
      <Table>
        <TableCaption>A list of recent visits.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ivanov I. I.</TableCell>
            <TableCell>Done</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(container.firstChild).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })
})
