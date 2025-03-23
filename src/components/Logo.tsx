const PRIMARY = {
  lighter: '#C8FACD',
  light: '#5BE584',
  main: '#00AB55',
  dark: '#007B55',
  darker: '#005249',
};

export default function Logo() {
  return (
    <div style={{ width: 40, height: 40, flexShrink: 0 }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
      >
        <defs>
          <linearGradient id="BG1" x1="100%" x2="50%" y1="9.946%" y2="50%">
            <stop offset="0%" stopColor={PRIMARY.dark} />
            <stop offset="100%" stopColor={PRIMARY.main} />
          </linearGradient>
          <linearGradient id="BG2" x1="50%" x2="50%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={PRIMARY.light} />
            <stop offset="100%" stopColor={PRIMARY.main} />
          </linearGradient>
          <linearGradient id="BG3" x1="50%" x2="50%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={PRIMARY.light} />
            <stop offset="100%" stopColor={PRIMARY.main} />
          </linearGradient>
        </defs>
        <g fill={PRIMARY.main} fillRule="evenodd" stroke="none" strokeWidth="1">
          <path
            fill="url(#BG2)"
            d="M8.9,10.2l5.7-9.9C13.8,0.1,12.9,0,12,0C9.1,0,6.5,1,4.4,2.7l4.4,7.6L8.9,10.2L8.9,10.2z"
          />
          <path
            fill="url(#BG2)"
            d="M23.4,8.4c-1.1-3.5-3.8-6.3-7.2-7.6l-4.4,7.6H23.4z"
          />
          <path
            fill="url(#BG2)"
            d="M23.8,9.6h-9l0.3,0.6l5.7,9.9c2-2.1,3.2-5,3.2-8.1C24,11.2,23.9,10.4,23.8,9.6L23.8,9.6z"
          />
          <path
            fill="url(#BG2)"
            d="M7.8,12L3.2,3.9C1.2,6,0,8.9,0,12c0,0.8,0.1,1.6,0.2,2.4h9L7.8,12z"
          />
          <path
            fill="url(#BG2)"
            d="M0.6,15.6c1.1,3.5,3.8,6.3,7.2,7.6l4.4-7.6H0.6z"
          />
          <path
            fill="url(#BG2)"
            d="M14.1,15.6l-4.7,8.1c0.8,0.2,1.7,0.3,2.6,0.3c2.9,0,5.5-1,7.6-2.7l-4.4-7.6L14.1,15.6L14.1,15.6z"
          />
        </g>
      </svg>
    </div>
  );
}
