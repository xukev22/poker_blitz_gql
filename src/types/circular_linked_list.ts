// A Node that represents a piece of data and the next node
class Node<T> {
  data: T;
  next: Node<T> | null;

  // Constructor to initialize the node with data
  constructor(data: T) {
    this.data = data;
    this.next = null;
  }
}

// A class for creating and representing circular linked list
export class CircularLinkedList<T> {
  head: Node<T> | null;

  // Constructor to initialize the circular linked list as empty
  constructor() {
    this.head = null;
  }

  // Append a new node with data to the circular linked list
  append(data: T): void {
    const newNode = new Node(data);
    if (!this.head) {
      // If the list is empty, set the new node as the head and make it circular
      this.head = newNode;
      newNode.next = this.head;
    } else {
      // If the list is not empty, find the last node and connect the new node
      let current = this.head;
      while (current.next !== this.head) {
        current = current.next!;
      }
      current.next = newNode;
      newNode.next = this.head;
    }
  }

  // Remove a node with specified data from the circular linked list
  remove(data: T): void {
    if (!this.head) {
      throw new Error("Circular list is empty");
    }

    // Special case for the head
    if (this.head.data === data) {
      if (this.head.next === this.head) {
        // Removing the only node
        this.head = null;
      } else {
        let current = this.head;
        while (current.next !== this.head) {
          current = current.next!;
        }
        current.next = this.head.next;
        this.head = this.head.next;
      }
      return;
    }

    let current = this.head;
    let prev: Node<T> | null = null;

    do {
      prev = current;
      current = current.next!;
    } while (current !== this.head && current.data !== data);

    if (current !== this.head) {
      prev!.next = current.next;
    }
  }

  // shuffle the elements of the circular linked list
  shuffle(): void {
    if (!this.head) {
      throw new Error("Circular list is empty");
    }

    // Convert the circular linked list to an array
    const nodeList: Node<T>[] = [];
    let current = this.head;
    do {
      nodeList.push(current);
      current = current.next!;
    } while (current !== this.head);

    // Shuffle the array
    const shuffledNodes = shuffleArray(nodeList);

    // Update the circular linked list with the shuffled elements
    for (let i = 0; i < shuffledNodes.length; i++) {
      shuffledNodes[i].next = shuffledNodes[(i + 1) % shuffledNodes.length];
    }

    this.head = shuffledNodes[0];
  }

  // clone the circular linked list
  clone(): CircularLinkedList<T> {
    const clonedList = new CircularLinkedList<T>();

    if (!this.head) {
      // Return an empty list if the original list is empty
      return clonedList;
    }

    let originalCurrent = this.head;
    do {
      clonedList.append(originalCurrent.data);
      originalCurrent = originalCurrent.next!;
    } while (originalCurrent !== this.head);

    return clonedList;
  }

  // Find a node with specified data in the circular linked list
  find(player: T): Node<T> | null {
    if (!this.head) {
      throw new Error("Circular list is empty");
    }

    let current = this.head;
    do {
      if (current.data === player) {
        return current;
      }
      current = current.next!;
    } while (current !== this.head);

    throw new Error("Could not find a node");
  }

  // Get the nth element in the circular linked list, 0 returns the first
  getNthElement(n: number): Node<T> | null {
    if (!this.head || n < 0) {
      throw new Error("Circular list is empty or invalid n");
    }

    if (n === 0) {
      return this.head; // Return the head for n = 0
    }

    let current = this.head;
    for (let i = 1; i < n; i++) {
      current = current.next!;
      if (current === this.head) {
        throw new Error(
          "Reached end of circular list, and n is larger than the list size"
        );
      }
    }

    return current;
  }

  // Get the length of the circular linked list
  length(): number {
    if (!this.head) {
      return 0;
    }

    let count = 0;
    let current = this.head;
    do {
      count++;
      current = current.next!;
    } while (current !== this.head);

    return count;
  }

  // Apply a callback function to each element in the circular linked list
  forEach(callback: (data: T) => void): void {
    if (!this.head) {
      return;
    }

    let current = this.head;
    do {
      callback(current.data);
      current = current.next!;
    } while (current !== this.head);
  }

  // Print the elements of the circular linked list
  print(): void {
    if (!this.head) {
      console.log("List is empty");
      return;
    }

    let current = this.head;
    do {
      console.log(current.data);
      current = current.next!;
    } while (current !== this.head);
  }
}

// Function to shuffle an array using the Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Example usage
const myList = new CircularLinkedList<number>();
myList.append(1);
myList.append(2);
myList.append(3);

console.log("Original list:");
myList.print();

console.log("Executing forEach:");
myList.forEach((data) => {
  console.log(data * 2); // Perform some operation (e.g., multiply each element by 2)
});

console.log("After forEach:");
myList.print();

module.exports = CircularLinkedList;
