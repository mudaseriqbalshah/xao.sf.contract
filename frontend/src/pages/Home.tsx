import React from 'react';
import { Typography, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        py: 8,
      }}
    >
      <Typography variant="h2" component="h1" align="center" gutterBottom>
        Welcome to XAO Ticketing
      </Typography>
      <Typography variant="h5" align="center" color="text.secondary" paragraph>
        Discover and purchase tickets for exclusive events using blockchain technology
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/events')}
        >
          Browse Events
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={() => navigate('/artists')}
        >
          View Artists
        </Button>
      </Box>
    </Box>
  );
};

export default Home;
