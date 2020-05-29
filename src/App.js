import React from 'react';
import './App.css';
import { Blockchain, Block, Transaction } from './blockchain';
import io from 'socket.io-client';
import { ec } from 'elliptic';

const _ec = new ec('secp256k1');

const blockchain = new Blockchain();

class App extends React.Component {
  state = {
    BitcoinFake: null,
    privateKey: '',
    publicKey: '',
    balance: 0
  }
  socket = null;

  async componentWillMount() {
    this.socket = io('localhost:3000');

    this.socket.on('UPDATED_BLOCKCHAIN', BitcoinFake => {
      this.setState({ BitcoinFake: BitcoinFake });
    });

    this.socket.on('UPDATED_TRANSACTIONS', transactions => {
      let newBlockChain = { ...this.state.BitcoinFake };
      newBlockChain.pendingTransactions = transactions;
      this.setState({ BitcoinFake: newBlockChain });
    });

    this.socket.on('TRANSACTIONS_NEED_TO_MINE', transactions => {
      const block = new Block(Date.now(), transactions, this.state.BitcoinFake.chain.slice(-1)[0].hash);
      block.mineBlock(this.state.BitcoinFake.difficulty);

      this.socket.emit('MINED', block);
    });
  }

  Register = () => {
    this.socket.emit('CREATE_NEW_WALLET');
    this.socket.on('NEW_WALLET', ({ publicKey, privateKey, balance }) => {
      this.setState({ publicKey, privateKey, balance });
    });
  }

  CreateNewTransaction = () => {
    if (this.state.balance <= 0) {
      alert('Số dư không đủ');
      return;
    }
    const balance = this.state.balance - 10;

    const myKey = _ec.keyFromPrivate(this.state.privateKey);

    const tx = new Transaction(this.state.publicKey, '122a2c2b2d22e222222f22b22aa2222', 10);
    tx.signTransaction(myKey);

    this.socket.emit('CREATE_NEW_TRANSACTION', tx);

    this.setState({ balance: balance >= 0 ? balance : 0 });
  }

  Mine = () => {
    this.socket.emit('MINE');
  }

  render() {
    const { BitcoinFake } = this.state;

    return (
      <div className="App" >
        <button onClick={() => this.Mine()}>Mine</button>
        <button onClick={() => this.Register()}>New wallet</button>
        <button onClick={() => this.CreateNewTransaction()}>New transaction</button>

        <div>-----------------------------------</div>

        <div>private key: {this.state.privateKey}</div>
        <div>public key: {this.state.publicKey}</div>
        <div>balance: {this.state.balance}</div>

        <div>-----------------------------------</div>

        <div>Blocks ({BitcoinFake ? BitcoinFake.chain.length : 0})</div>
        <div>{JSON.stringify(BitcoinFake ? BitcoinFake.chain : [])}</div>

        <div>-----------------------------------</div>

        <div>Pendding transactions({BitcoinFake ? BitcoinFake.pendingTransactions.length : 0})</div>
        <div>{JSON.stringify(BitcoinFake ? BitcoinFake.pendingTransactions : [])}</div>
      </div>
    );
  }
}

export default App;
