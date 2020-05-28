import React from 'react';
import './App.css';
import { Blockchain, Block, Transaction } from './blockchain';
import io from 'socket.io-client';
import axios from 'axios';
import { findAllByAltText } from '@testing-library/react';

const blockchain = new Blockchain();

class App extends React.Component {
  state = {
    BitcoinFake: null,
    privateKey: null,
    publicKey: null,
  }
  socket = null;

  async componentWillMount() {
    this.socket = io('localhost:3000');

    this.socket.on('CURRENT_BLOCKCHAIN', BitcoinFake => {
      this.setState({ BitcoinFake: BitcoinFake });
    });

    this.socket.on('UPDATED_TRANSACTIONS', transactions => {
      let newBlockChain = { ...this.state.BitcoinFake };
      newBlockChain.pendingTransactions = transactions;
      this.setState({ BitcoinFake: newBlockChain });
    });
  }

  Register = () => {
    this.socket.emit('CREATE_NEW_WALLET');
    this.socket.on('NEW_WALLET', ({ publicKey, privateKey }) => {
      this.setState({ publicKey, privateKey });
    });
  }

  CreateNewTransaction = () => {
    this.socket.emit('CREATE_NEW_TRANSACTION', {
      privateKey: this.state.privateKey,
      sender: this.state.publicKey,
      receiver: "122a2c2b2d22e222222f22b22aa2222",
      amount: 10
    });
  }

  Mine = async () => {
    const block = new Block(Date.now(), this.state.transactions, this.state.lastestBlock.hash);
    block.mineBlock(this.state.BitcoinFake.difficulty);

    try {
      const res = await axios.post('http://localhost:3000/new_block', {
        block
      }, {
        'Content-Type': 'application/json'
      });
      this.setState({ ...res.data });
    } catch (error) {
      alert(JSON.stringify(error))
    }
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

        <div>-----------------------------------</div>

        <div>Blocks ({BitcoinFake ? BitcoinFake.chain.length : 0})</div>
        <div>{JSON.stringify(BitcoinFake ? BitcoinFake.chain : [])}</div>

        <div>-----------------------------------</div>

        <div>Transactions ({BitcoinFake ? BitcoinFake.pendingTransactions.length : 0})</div>
        <div>{JSON.stringify(BitcoinFake ? BitcoinFake.pendingTransactions : [])}</div>
      </div>
    );
  }
}

export default App;
