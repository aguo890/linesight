import { render, screen, fireEvent } from '@testing-library/react';
import LocationSelector from '../LocationSelector';
import { vi } from 'vitest';

// Mock the heavy dependencies to keep unit test fast and focused on logic
vi.mock('countries-and-timezones', () => ({
    default: {
        getAllCountries: () => ({
            'EG': { id: 'EG', name: 'Egypt', timezones: ['Africa/Cairo'] },
            'US': { id: 'US', name: 'United States', timezones: ['America/New_York', 'America/Los_Angeles'] },
            'AQ': { id: 'AQ', name: 'Antarctica', timezones: [] }
        }),
        getCountry: (id: string) => {
            const db: Record<string, any> = {
                'EG': { id: 'EG', name: 'Egypt', timezones: ['Africa/Cairo'] },
                'US': { id: 'US', name: 'United States', timezones: ['America/New_York', 'America/Los_Angeles'] },
                'AQ': { id: 'AQ', name: 'Antarctica', timezones: [] }
            };
            return db[id] || null;
        }
    }
}));

// Mock date-fns-tz
vi.mock('date-fns-tz', () => ({
    getTimezoneOffset: (tz: string) => {
        if (tz === 'Africa/Cairo') return 7200000; // +2 hours
        if (tz === 'America/New_York') return -18000000; // -5 hours
        return 0;
    }
}));

describe('LocationSelector Logic', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders correctly with initial values', () => {
        render(<LocationSelector countryCode="EG" timezone="Africa/Cairo" onChange={mockOnChange} />);

        // Input should show country name
        expect(screen.getByDisplayValue('Egypt')).toBeInTheDocument();

        // Select should have value
        // The implementation has a <select> and an <input type="text">.
        expect(screen.getByDisplayValue('Cairo (GMT+2)')).toBeInTheDocument();
    });

    it('filters timezones correctly when country is selected (EG)', async () => {
        render(<LocationSelector countryCode="EG" timezone="Africa/Cairo" onChange={mockOnChange} />);

        const options = screen.getAllByRole('option');
        // Africa/Cairo is the only one for EG in our mock
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent('Cairo (GMT+2)');
    });

    it('updates available timezones when country changes to one with multiple zones (US)', () => {
        // We can't easily test the "change country" interaction fully with just props, 
        // because the parent controls the props. 
        // But we can test that IF the props change, the list updates.
        const { rerender } = render(<LocationSelector countryCode="EG" timezone="Africa/Cairo" onChange={mockOnChange} />);

        rerender(<LocationSelector countryCode="US" timezone="America/New_York" onChange={mockOnChange} />);

        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(2);
        expect(options[0]).toHaveTextContent('New York (GMT-5)');
        expect(options[1]).toHaveTextContent('Los Angeles (GMT+0)'); // Mock returns 0 for unknown, or we didn't mock LA offset. 
        // Wait, our mock for getAllCountries US has 2 zones.
        // Our mock for getTimezoneOffset only handles Cairo and NY. LA will return 0.
        // So expected: 'Los Angeles (GMT+0)' or similiar.
    });

    it('handles country with empty timezones (Antarctica)', () => {
        render(<LocationSelector countryCode="AQ" timezone="" onChange={mockOnChange} />);
        const options = screen.queryAllByRole('option');
        expect(options).toHaveLength(0);
    });

    it('logic: selection triggers onChange with correct default timezone', async () => {
        render(<LocationSelector countryCode="" timezone="" onChange={mockOnChange} />);

        // Type 'Egypt'
        const input = screen.getByPlaceholderText('Search Country...');
        fireEvent.change(input, { target: { value: 'Egypt' } });
        fireEvent.focus(input);

        // Click the option
        const updateButton = screen.getByText('Egypt');
        fireEvent.click(updateButton);

        // Expect onChange to be called with EG and Africa/Cairo (default)
        expect(mockOnChange).toHaveBeenCalledWith({
            countryCode: 'EG',
            timezone: 'Africa/Cairo'
        });
    });
});
