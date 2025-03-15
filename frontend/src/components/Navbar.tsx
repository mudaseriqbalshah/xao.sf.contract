import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  useTheme,
} from '@mui/material';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';

const Navbar = () => {
  const theme = useTheme();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({
    connector: new MetaMaskConnector(),
  });
  const { disconnect } = useDisconnect();

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          XAO Ticketing
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button color="inherit" component={RouterLink} to="/">
            Home
          </Button>
          <Button color="inherit" component={RouterLink} to="/artists">
            Artists
          </Button>
          <Button color="inherit" component={RouterLink} to="/events">
            Events
          </Button>
          {isConnected ? (
            <>
              <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                {`${address?.slice(0, 6)}...${address?.slice(-4)}`}
              </Typography>
              <Button color="inherit" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button color="inherit" onClick={() => connect()}>
              Connect Wallet
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
