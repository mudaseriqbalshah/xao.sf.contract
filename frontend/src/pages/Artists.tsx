import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Avatar,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import { useAccount, useContractRead, useContractWrite } from 'wagmi';
import { CONTRACT_ADDRESSES } from '../config/wagmi';
import ArtistFactoryABI from '../contracts/ArtistFactory.json';

interface Artist {
  id: string;
  name: string;
  genre: string;
  upcomingEvents: number;
  verified: boolean;
}

const Artists = () => {
  const { isConnected } = useAccount();
  const [artists, setArtists] = useState<Artist[]>([]);

  // Read artists from the ArtistFactory contract
  const { data: artistsList, isError, isLoading } = useContractRead({
    address: CONTRACT_ADDRESSES.ArtistFactory as `0x${string}`,
    abi: ArtistFactoryABI.abi,
    functionName: 'getArtists',
    watch: true,
  });

  // Example of writing to the contract (e.g., verifying an artist)
  const { write: verifyArtist } = useContractWrite({
    address: CONTRACT_ADDRESSES.ArtistFactory as `0x${string}`,
    abi: ArtistFactoryABI.abi,
    functionName: 'verifyArtist',
  });

  useEffect(() => {
    if (artistsList && Array.isArray(artistsList)) {
      const formattedArtists = artistsList.map((artist: any) => ({
        id: artist.id.toString(),
        name: artist.name || '',
        genre: artist.genre || '',
        upcomingEvents: Number(artist.upcomingEvents || 0),
        verified: artist.verified || false,
      }));
      setArtists(formattedArtists);
    }
  }, [artistsList]);

  const handleVerifyArtist = async (artistId: string) => {
    try {
      verifyArtist({ args: [BigInt(artistId)] });
    } catch (error) {
      console.error('Error verifying artist:', error);
    }
  };

  if (!isConnected) {
    return (
      <Container maxWidth="lg">
        <Alert severity="info" sx={{ mt: 4 }}>
          Please connect your wallet to view artists
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 4 }}>
        Featured Artists
      </Typography>

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">Error loading artists</Alert>
      ) : (
        <Grid container spacing={3}>
          {artists.map((artist) => (
            <Grid item xs={12} sm={6} md={4} key={artist.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Avatar sx={{ width: 56, height: 56, mr: 2 }}>
                      {artist.name[0]}
                    </Avatar>
                    <Typography variant="h6">{artist.name}</Typography>
                  </Box>
                  <Typography variant="body1" color="text.secondary">
                    {artist.genre}
                  </Typography>
                  <Typography variant="body2">
                    Upcoming Events: {artist.upcomingEvents}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color={artist.verified ? "success.main" : "text.secondary"}
                  >
                    {artist.verified ? "Verified Artist" : "Unverified"}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    onClick={() => handleVerifyArtist(artist.id)}
                    disabled={artist.verified}
                  >
                    {artist.verified ? "Verified" : "Verify Artist"}
                  </Button>
                  <Button size="small">View Events</Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default Artists;
