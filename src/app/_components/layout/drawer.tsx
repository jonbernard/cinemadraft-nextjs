'use client';

import * as React from 'react';

import Link from 'next/link';

import {
  AutoStories as AutoStoriesIcon,
  EmojiEvents as EmojiEventsIcon,
  TheatersOutlined as TheatersOutlinedIcon,
} from '@mui/icons-material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Drawer as MuiDrawer,
  Typography,
} from '@mui/material';
import { CSSObject, Theme, styled } from '@mui/material/styles';

import Logo from '@/components/Logo';
import { AwardShows, Browse, RulesAndScoring } from '@/routes';

const drawerWidth = 280;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: theme.spacing(0, 1),
  gap: 12,
  marginLeft: 4,
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  variants: [
    {
      props: ({ open }) => open,
      style: {
        ...openedMixin(theme),
        '& .MuiDrawer-paper': openedMixin(theme),
      },
    },
    {
      props: ({ open }) => !open,
      style: {
        ...closedMixin(theme),
        '& .MuiDrawer-paper': closedMixin(theme),
      },
    },
  ],
}));

const routes = [
  {
    label: Browse.routeLabel,
    url: Browse(),
    icon: <TheatersOutlinedIcon />,
  },
  {
    label: AwardShows.routeLabel,
    url: AwardShows(),
    icon: <EmojiEventsIcon />,
  },
  {
    label: RulesAndScoring.routeLabel,
    url: RulesAndScoring(),
    icon: <AutoStoriesIcon />,
  },
];

export default function LayoutDrawer({
  open,
  handleDrawerClose,
  handleDrawerOpen,
}: {
  open: boolean;
  handleDrawerClose: () => void;
  handleDrawerOpen: () => void;
}) {
  return (
    <Drawer variant="permanent" open={open}>
      <DrawerHeader>
        <Logo />
        <Typography variant="h6" className="font-semibold">
          Cinemadraft
        </Typography>
      </DrawerHeader>
      {/* <Divider /> */}
      <List>
        {routes.map((route) => (
          <ListItem key={route.label} disablePadding sx={{ display: 'block' }}>
            <ListItemButton
              LinkComponent={Link}
              sx={[
                { minHeight: 48, px: 2.5 },
                open
                  ? { justifyContent: 'initial' }
                  : { justifyContent: 'center' },
              ]}
              href={route.url}
            >
              <ListItemIcon
                sx={[
                  { minWidth: 0, justifyContent: 'center' },
                  open ? { mr: 3 } : { mr: 'auto' },
                ]}
              >
                {route.icon}
              </ListItemIcon>
              <ListItemText
                primary={route.label}
                sx={open ? { opacity: 1 } : { opacity: 0 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <div className="grow" />
      <List>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <ListItemButton
            sx={[
              {
                minHeight: 48,
                px: 2.5,
              },
              open
                ? { justifyContent: 'flex-end' }
                : { justifyContent: 'center' },
            ]}
            onClick={open ? handleDrawerClose : handleDrawerOpen}
          >
            <ListItemIcon
              sx={[
                {
                  minWidth: 0,
                  justifyContent: 'center',
                },
              ]}
            >
              {!open ? <MenuIcon /> : <ChevronLeftIcon />}
            </ListItemIcon>
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  );
}
