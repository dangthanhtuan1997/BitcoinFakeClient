import React from 'react';
import './App.css';
import { Block, Transaction } from './blockchain';
import io from 'socket.io-client';
import { ec } from 'elliptic';
import 'antd/dist/antd.css';
import { Timeline, Row, Col, Collapse, Alert, Input, Button, Card } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Panel } = Collapse;
const { Search } = Input;
const _ec = new ec('secp256k1');

const tabListNoTitle = [
  {
    key: '1',
    tab: 'Blockchain system',
  },
  {
    key: '2',
    tab: 'Blockchain explorer',
  }
];

class App extends React.Component {
  state = {
    BitcoinFake: null,
    privateKey: '',
    publicKey: '',
    balance: 0,
    errorVisible: false,
    errorContent: '',
    mining: false,
    receiver: '',
    amount: 0,
    key: 'tab0',
    noTitleKey: '1',
    resultTransaction: [],
    search: ''
  }

  socket = null;

  onTabChange = (key, type) => {
    console.log(key, type);
    this.setState({ [type]: key });
  };

  async componentWillMount() {
    this.socket = io('http://bitcoinfake-api.herokuapp.com/');

    this.socket.on('UPDATED_BLOCKCHAIN', BitcoinFake => {
      this.setState({ BitcoinFake: BitcoinFake });
      this.socket.emit('CHECK_BALANCE', this.state.publicKey);
    });

    this.socket.on('BALANCE_RESULT', balance => {
      this.setState({ balance });
    });

    this.socket.on('REWARD', reward => {
      this.setState({ balance: this.state.balance + reward, mining: false });
    });

    this.socket.on('UPDATED_TRANSACTIONS', transactions => {
      let newBlockChain = { ...this.state.BitcoinFake };
      newBlockChain.pendingTransactions = transactions;

      this.setState({ BitcoinFake: newBlockChain });
    });

    this.socket.on('TRANSACTIONS_NEED_TO_MINE', (transactions) => {
      this.setState({ mining: true });

      setTimeout(() => {
        const block = new Block(Date.now(), transactions, this.state.BitcoinFake.chain.slice(-1)[0].hash);
        block.mineBlock(this.state.BitcoinFake.difficulty);

        this.socket.emit('MINED', block, this.state.publicKey);
      }, 500);
    });

    this.socket.on('NEW_WALLET', ({ publicKey, privateKey, balance }) => {
      this.setState({ publicKey, privateKey, balance });
    });

    this.socket.on('EXPLORE_TRANSACTION_RESULT', transactions => {
      this.setState({ resultTransaction: transactions });
    });
  }

  Register = () => {
    this.socket.emit('CREATE_NEW_WALLET');
  }

  Explore = (publicKey) => {
    this.socket.emit('EXPLORE_TRANSACTION', publicKey);
  }

  CreateNewTransaction = () => {
    if (this.state.balance <= 0) {
      this.setState({ errorVisible: true, errorContent: 'Số dư không đủ hoặc chưa đăng ký ví' });
      return;
    }

    if (this.state.receiver <= 0) {
      this.setState({ errorVisible: true, errorContent: 'Chưa nhập ví của người nhận' });
      return;
    }

    if (this.state.amount <= 0) {
      this.setState({ errorVisible: true, errorContent: 'Số lượng cần chuyển phải lớn hơn 0' });
      return;
    }

    if (this.state.publicKey === this.state.receiver) {
      this.setState({ errorVisible: true, errorContent: 'Ví người nhận phải khác ví của bạn' });
      return;
    }
    const balance = this.state.balance - this.state.amount;

    const myKey = _ec.keyFromPrivate(this.state.privateKey);

    const tx = new Transaction(this.state.publicKey, this.state.receiver, this.state.amount);
    tx.signTransaction(myKey);

    this.socket.emit('CREATE_NEW_TRANSACTION', tx);

    this.setState({ balance: balance >= 0 ? balance : 0 });
  }

  Mine = () => {
    if (this.state.BitcoinFake.pendingTransactions.length <= 0) {
      this.setState({ errorVisible: true, errorContent: 'Hiện không có giao dịch để xử lý' });
      return;
    }

    this.socket.emit('MINE');
  }

  render() {
    return (
      <Row style={{ marginTop: 10 }}>
        <Col span={8}>
          <Row style={{ marginTop: 10 }}>
            {this.state.errorVisible ? (
              <Alert message={this.state.errorContent} type="error" closable afterClose={() => this.setState({ errorVisible: false })} />
            ) : null}
          </Row>

          <Row style={{ marginTop: 10 }}>
            <Col span={12}>
              <Button onClick={() => this.Register()}>New wallet</Button>
            </Col>

            <Col span={12}>
              <Button onClick={() => this.Mine()} loading={this.state.mining}>
                Mine
            </Button>
            </Col>
          </Row>

          <Row>
            <Input style={{ marginTop: 10 }} addonBefore="Private key" value={this.state.privateKey} onChange={(e) => {
              this.setState({ privateKey: e.target.value })
            }} />
          </Row>

          <Row>
            <Input style={{ marginTop: 10 }} addonBefore="Public key" value={this.state.publicKey} onChange={(e) => {
              this.setState({ publicKey: e.target.value })
            }} />
          </Row>

          <Row>
            <div style={{ marginTop: 10 }}>
              Balance: {this.state.balance}
            </div>
          </Row>

          <Row justify="space-around" align="middle">
            <Col span={16}>
              <Input style={{ marginTop: 10 }} addonBefore="To" value={this.state.receiver} onChange={(e) => {
                this.setState({ receiver: e.target.value })
              }} />
              <Input type='number' style={{ marginTop: 10 }} addonBefore="Amount" value={this.state.amount} onChange={(e) => {
                this.setState({ amount: e.target.value })
              }} />
            </Col>

            <Col span={8}>
              <Row style={{ marginTop: 10, marginLeft: 10 }}>
                <Button onClick={() => this.CreateNewTransaction()}>New transaction</Button>
              </Row>
            </Col>
          </Row>

        </Col>
        <Col span={16}>

          <Row style={{ marginTop: 10 }}>
            <Card
              style={{ width: '100%' }}
              tabList={tabListNoTitle}
              activeTabKey={this.state.noTitleKey}
              onTabChange={key => {
                this.onTabChange(key, 'noTitleKey');
              }}
            >
              {this.state.noTitleKey === '1' ? (
                <div style={{ flexDirection: 'row', display: 'flex' }}>
                  <Col span={12} style={{ paddingLeft: 10, paddingRight: 10 }}>
                    <Timeline pending="New block is being processed..." reverse={true}>
                      {this.state.BitcoinFake ? this.state.BitcoinFake.chain.map((block, index) =>
                        <Timeline.Item color={index === 0 ? "green" : "red"}>
                          <p>Block #{index + 1} {moment(block.timestamp).format('YYYY-MM-DD HH:mm:ss')}</p>

                          <Collapse onChange={() => { }}>
                            <Panel header="Previous Hash" key="1">
                              <p>{block.previousHash}</p>
                            </Panel>
                            <Panel header="Transactions" key="2">
                              {block.transactions.map((transaction, index) =>
                                <div>
                                  <p>Transaction {moment(transaction.timestamp).format('YYYY-MM-DD HH:mm:ss')}</p>

                                  <Collapse onChange={() => { }}>
                                    <Panel header={`TXID: ${transaction.TXID}`} key={index}>
                                      <p>From: {transaction.fromAddress}</p>
                                      <p>To: {transaction.toAddress}</p>
                                      <p>Amount: {transaction.amount}</p>
                                    </Panel>
                                  </Collapse>
                                </div>
                              )}
                            </Panel>
                            <Panel header="Hash" key="3">
                              <p>{block.hash}</p>
                            </Panel>
                            <Panel header="Nonce" key="4">
                              <p>{block.nonce}</p>
                            </Panel>
                          </Collapse>
                        </Timeline.Item>
                      ) : null}
                    </Timeline>
                  </Col>

                  <Col span={12} style={{ paddingLeft: 10, paddingRight: 10 }}>
                    <Timeline reverse={true}>
                      {this.state.BitcoinFake ? this.state.BitcoinFake.pendingTransactions.map((transaction, index) =>
                        <Timeline.Item dot={<ClockCircleOutlined className="timeline-clock-icon" />} color="red">
                          <p>Transaction {moment(transaction.timestamp).format('YYYY-MM-DD HH:MM:SS')}</p>

                          <Collapse onChange={() => { }}>
                            <Panel header={`TXID: ${transaction.TXID}`} key="1">
                              <p>From: {transaction.fromAddress}</p>
                              <p>To: {transaction.toAddress}</p>
                              <p>Amount: {transaction.amount}</p>
                            </Panel>
                          </Collapse>
                        </Timeline.Item>
                      ) : null}
                    </Timeline>
                  </Col>
                </div>) : null}

              {this.state.noTitleKey === '2' ? (
                <>
                  <Row style={{ width: '100%' }}>
                    <Search placeholder="input search text" value={this.state.search} onChange={(e) => {
                      this.setState({ search: e.target.value })
                    }}
                      onSearch={value => this.Explore(value)} enterButton />
                  </Row>
                  <Row style={{ width: '100%', marginTop: 20 }}>
                    <Timeline reverse={true}>
                      {this.state.resultTransaction.map((transaction, index) =>
                        <Timeline.Item dot={<ClockCircleOutlined className="timeline-clock-icon" />} color="red" >
                          <p>Transaction {moment(transaction.timestamp).format('YYYY-MM-DD HH:MM:SS')}</p>

                          <Collapse style={{ background: this.state.BitcoinFake.pendingTransactions.find(x => x.TXID === transaction.TXID) ? 'yellow' : transaction.toAddress === this.state.search ? 'green': 'red' }} onChange={() => { }}>
                            <Panel header={`TXID: ${transaction.TXID}`} key="1">
                              <p>From: {transaction.fromAddress}</p>
                              <p>To: {transaction.toAddress}</p>
                              <p>Amount: {transaction.amount}</p>
                            </Panel>
                          </Collapse>
                        </Timeline.Item>
                      )}

                      {this.state.resultTransaction.length === 0 ?
                        <>
                          No transactions yet
                      </> : null}
                    </Timeline>
                  </Row>
                </>
              ) : null}
            </Card>
          </Row>
        </Col>

      </Row>
    );
  }
}

export default App;
