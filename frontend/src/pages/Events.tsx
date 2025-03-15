import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Box,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAccount, useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { CONTRACT_ADDRESSES } from '../config/wagmi';
import EventFactoryABI from '../contracts/EventFactory.json';

interface Event {
  id: string;
  name: string;
  venue: string;
  date: string;
  price: string;
  available: number;
  artistId: string;
}

const Events = () => {
  const { address, isConnected } = useAccount();
  const [events, setEvents] = useState<Event[]>([]);
  const [purchaseStatus, setPurchaseStatus] = useState<{[key: string]: 'idle' | 'loading' | 'success' | 'error'}>({});

  // Read events from the contract
  const { data: eventsList, isError, isLoading } = useContractRead({
    address: CONTRACT_ADDRESSES.EventFactory as `0x${string}`,
    abi: EventFactoryABI.abi,
    functionName: 'getEvents',
    watch: true,
  });

  // Write interaction for purchasing tickets
  const { write: purchaseTicket, data: purchaseData } = useContractWrite({
    address: CONTRACT_ADDRESSES.EventFactory as `0x${string}`,
    abi: EventFactoryABI.abi,
    functionName: 'purchaseTicket',
  });

  // Track transaction status
  const { isLoading: isPurchaseLoading, isSuccess: isPurchaseSuccess } = useWaitForTransaction({
    hash: purchaseData?.hash,
  });

  useEffect(() => {
    if (eventsList && Array.isArray(eventsList)) {
      const formattedEvents = eventsList.map((event: any, index: number) => ({
        id: index.toString(),
        name: event.name || '',
        venue: event.venue || '',
        date: new Date(Number(event.date || 0) * 1000).toLocaleDateString(),
        price: event.price ? (Number(event.price) / 1e18).toString() : '0',
        available: Number(event.availableTickets || 0),
        artistId: event.artistId || '',
      }));
      setEvents(formattedEvents);
    }
  }, [eventsList]);

  const handlePurchaseTicket = async (eventId: string) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setPurchaseStatus(prev => ({ ...prev, [eventId]: 'loading' }));
      purchaseTicket({ 
        args: [BigInt(eventId)],
        value: BigInt(events.find(e => e.id === eventId)?.price || 0),
      });
    } catch (err) {
      console.error('Purchase error:', err);
      setPurchaseStatus(prev => ({ ...prev, [eventId]: 'error' }));
    }
  };

  useEffect(() => {
    if (isPurchaseSuccess && purchaseData?.hash) {
      const eventId = purchaseData.hash;
      setPurchaseStatus(prev => ({ ...prev, [eventId]: 'success' }));
      setTimeout(() => {
        setPurchaseStatus(prev => ({ ...prev, [eventId]: 'idle' }));
      }, 3000);
    }
  }, [isPurchaseSuccess, purchaseData]);

  if (!isConnected) {
    return (
      <Container maxWidth="lg">
        <Alert severity="info" sx={{ mt: 4 }}>
          Please connect your wallet to view and purchase tickets
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 4 }}>
        Available Events
      </Typography>

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">Error loading events</Alert>
      ) : (
        <Grid container spacing={3}>
          {events.map((event) => (
            <Grid item xs={12} sm={6} md={4} key={event.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {event.name}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {event.venue}
                  </Typography>
                  <Typography variant="body2">
                    Date: {event.date}
                  </Typography>
                  <Typography variant="body2">
                    Price: {event.price} ETH
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Chip
                      label={`${event.available} tickets available`}
                      color={event.available > 0 ? "primary" : "error"}
                      variant="outlined"
                    />
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    fullWidth
                    size="small"
                    variant="contained"
                    onClick={() => handlePurchaseTicket(event.id)}
                    disabled={
                      event.available === 0 || 
                      isPurchaseLoading || 
                      purchaseStatus[event.id] === 'loading'
                    }
                  >
                    {purchaseStatus[event.id] === 'loading' ? 'Processing...' :
                     purchaseStatus[event.id] === 'success' ? 'Purchased!' :
                     purchaseStatus[event.id] === 'error' ? 'Failed - Try Again' :
                     'Purchase Ticket'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default Events;
